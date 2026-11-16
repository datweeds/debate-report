import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sealText } from '@/lib/societyCrypto';
import { societyContentAccess } from '@/lib/societies';
import { removeFile } from '@/lib/documents';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string; docId: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

async function load(societyId: number, docId: string) {
  if (!UUID.test(docId)) return null;
  const { rows: [d] } = await pool.query(
    'SELECT id, uploaded_by, stored_name FROM documents WHERE id = $1 AND customer_id = $2 AND deleted_at IS NULL',
    [docId, societyId],
  );
  return d ?? null;
}

// PATCH { title?, description?, folderId? } — the uploader or a moderator.
async function handlePATCH(req: NextRequest, { params }: Params) {
  const { id, docId } = await params;
  const a = await societyContentAccess(req, id);
  const doc = a ? await load(a.societyId, docId) : null;
  if (!a || !doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (doc.uploaded_by !== a.session?.sub && !a.canModerate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const sets: string[] = []; const vals: unknown[] = [];
  const set = (c: string, v: unknown) => { vals.push(v); sets.push(`${c} = $${vals.length}`); };
  if (typeof body.title === 'string' && body.title.trim()) set('title', await sealText(a.societyId, body.title.trim().slice(0, 200)));
  if (typeof body.description === 'string') set('description', await sealText(a.societyId, body.description.trim().slice(0, 2000) || null));
  if ('folderId' in body) {
    if (body.folderId === null || body.folderId === 'root') set('folder_id', null);
    else if (typeof body.folderId === 'string' && UUID.test(body.folderId)) {
      const { rows } = await pool.query('SELECT 1 FROM document_folders WHERE id = $1 AND customer_id = $2', [body.folderId, a.societyId]);
      if (!rows.length) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
      set('folder_id', body.folderId);
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
  return NextResponse.json({ ok: true });
}

export const PATCH = lockSafe(handlePATCH);
