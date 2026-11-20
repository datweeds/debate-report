import { NextRequest, NextResponse } from 'next/server';
import { sealedFor } from '@/lib/sealed/server';
import { sealRootOf } from '@/lib/sealed/folders';
import pool from '@/lib/db';
import { openRows, sealText } from '@/lib/societyCrypto';
import { societyContentAccess } from '@/lib/societies';
import { NOTE_MAX_CHARS, NOTE_SEALED_MAX, removeFile } from '@/lib/documents';
import { lockSafe } from '@/lib/lockSafe';
import { revokeShares } from '@/lib/documentShares';

type Params = { params: Promise<{ id: string; docId: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

async function load(societyId: number, docId: string) {
  if (!UUID.test(docId)) return null;
  const { rows: [d] } = await pool.query(
    'SELECT id, kind, uploaded_by, stored_name, folder_id, protection FROM documents WHERE id = $1 AND customer_id = $2 AND deleted_at IS NULL',
    [docId, societyId],
  );
  return d ?? null;
}

// GET — a note, to read (counted as an open) or, with ?edit=1, to edit (not counted).
// A sealed note comes back as stored, with the sealed folder whose key opens it.
export async function GET(req: NextRequest, { params }: Params) {
  const { id, docId } = await params;
  const a = await societyContentAccess(req, id);
  if (!a || !UUID.test(docId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const count = req.nextUrl.searchParams.get('edit') === '1' ? 0 : 1;
  const { rows: [d] } = await pool.query(
    `UPDATE documents SET open_count = open_count + $3
     WHERE id = $1 AND customer_id = $2 AND kind = 'note' AND deleted_at IS NULL
     RETURNING id, kind, title, body, folder_id, protection, uploaded_by, created_at, updated_at`,
    [docId, a.societyId, count]);
  if (!d) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (d.protection !== 'sealed') await openRows(a.societyId, [d], ['title', 'body']);
  const root = d.protection === 'sealed' ? await sealRootOf(a.societyId, d.folder_id) : null;
  const res = NextResponse.json({ note: { ...d, seal_root: root?.id ?? null } });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

// PATCH { title?, description?, body? (notes), folderId? } — the uploader or a moderator.
async function handlePATCH(req: NextRequest, { params }: Params) {
  const { id, docId } = await params;
  const a = await societyContentAccess(req, id);
  const doc = a ? await load(a.societyId, docId) : null;
  if (!a || !doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (doc.uploaded_by !== a.session?.sub && !a.canModerate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const sets: string[] = []; const vals: unknown[] = [];
  const set = (c: string, v: unknown) => { vals.push(v); sets.push(`${c} = $${vals.length}`); };
  // A sealed document's details arrive sealed; others must be plain
  const root = doc.protection === 'sealed' ? await sealRootOf(a.societyId, doc.folder_id) : null;
  const ok = (v: unknown) => root ? sealedFor(root, v, 30000) : !(typeof v === 'string' && v.startsWith('sn1:'));
  if ([body.title, body.description].some(v => typeof v === 'string' && v.trim() && !ok(v))) {
    return NextResponse.json({ error: root ? 'This sealed folder’s keys have changed: reload the page and try again' : 'This document isn’t sealed' }, { status: 400 });
  }
  if (typeof body.title === 'string' && body.title.trim()) set('title', root ? body.title : await sealText(a.societyId, body.title.trim().slice(0, 200)));
  if (typeof body.description === 'string') set('description', root ? body.description || null : await sealText(a.societyId, body.description.trim().slice(0, 2000) || null));
  if (typeof body.body === 'string' && doc.kind === 'note') {
    if (root ? !(body.body === '' || sealedFor(root, body.body, NOTE_SEALED_MAX)) : body.body.startsWith('sn1:')) {
      return NextResponse.json({ error: root ? 'This sealed folder’s keys have changed: reload the page and try again' : 'This document isn’t sealed' }, { status: 400 });
    }
    if (!root && body.body.length > NOTE_MAX_CHARS) return NextResponse.json({ error: 'This note is too long. Split it into two notes, or upload it as a file.' }, { status: 413 });
    set('body', root ? body.body || null : await sealText(a.societyId, body.body || null));
  }
  if ('folderId' in body) {
    const target = body.folderId === null || body.folderId === 'root' ? null : typeof body.folderId === 'string' && UUID.test(body.folderId) ? body.folderId : undefined;
    if (target) {
      const { rows } = await pool.query('SELECT 1 FROM document_folders WHERE id = $1 AND customer_id = $2', [target, a.societyId]);
      if (!rows.length) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }
    // Moving into, out of, or between sealed folders would need re-encrypting in a browser
    if (target !== undefined) {
      const [from, to] = await Promise.all([sealRootOf(a.societyId, doc.folder_id), sealRootOf(a.societyId, target)]);
      if ((from?.id ?? null) !== (to?.id ?? null) || (to && doc.protection !== 'sealed')) {
        return NextResponse.json({ error: 'Documents can’t be moved into, out of or between sealed folders. Download it and upload it where you want it.' }, { status: 409 });
      }
      set('folder_id', target);
    }
  }
  if (sets.length) {
    vals.push(docId);
    await pool.query(`UPDATE documents SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}`, vals);
  }
  return NextResponse.json({ ok: true });
}

// DELETE — the uploader, a moderator, or SysAdmin (takedown). The file is removed from disk.
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id, docId } = await params;
  const a = await societyContentAccess(req, id);
  const doc = a ? await load(a.societyId, docId) : null;
  if (!a || !doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (doc.uploaded_by !== a.session?.sub && !a.canTakeDown) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await pool.query('UPDATE documents SET deleted_at = now(), stored_name = NULL WHERE id = $1', [docId]);
  await removeFile(a.societyId, doc.stored_name);
  await revokeShares(a.societyId, { documentId: docId });
  return NextResponse.json({ ok: true });
}

export const PATCH = lockSafe(handlePATCH);
