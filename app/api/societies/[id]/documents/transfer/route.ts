import { NextRequest, NextResponse } from 'next/server';
import { folderTree, sealRootOf, sealRoots } from '@/lib/sealed/folders';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { moderatedSocietyIds } from '@/lib/roles';
import { transferDocument, transferFolder } from '@/lib/portability';
import { lockSafe } from '@/lib/lockSafe';
import { folderPaths } from '@/lib/folders';

type Params = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

// GET — where this moderator can move or copy documents: this Society first
// (another folder here), then the other Societies they moderate, with folders.
export async function GET(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a?.session || !a.canModerate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const others = (await moderatedSocietyIds(a.session.sub)).filter(x => x !== a.societyId);
  const { rows } = await pool.query('SELECT id, name FROM customers WHERE id = ANY($1::int[]) ORDER BY name', [[a.societyId, ...others]]);
  const societies = [...rows.filter(r => r.id === a.societyId).map(r => ({ ...r, current: true })), ...rows.filter(r => r.id !== a.societyId)];
  const folders = await folderPaths([a.societyId, ...others]);
  return NextResponse.json({ societies, folders, current: a.societyId });
}

// POST { items: [{ type: 'doc' | 'folder', id }], targetSocietyId, targetFolderId?, mode }
// — a moderator of both Societies moves or copies documents and folders.
async function handlePOST(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a?.session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const target = Number(b.targetSocietyId);
  const mode = b.mode === 'copy' ? 'copy' : b.mode === 'move' ? 'move' : null;
  const items = Array.isArray(b.items) ? b.items.filter((i: { type?: string; id?: string }) => (i?.type === 'doc' || i?.type === 'folder') && UUID.test(i.id ?? '')) : [];
  if (!mode || !target || !items.length) return NextResponse.json({ error: 'Choose what to send, where, and whether to move or copy' }, { status: 400 });
  const mine = await moderatedSocietyIds(a.session.sub);
  if (!mine.includes(a.societyId) || !mine.includes(target)) return NextResponse.json({ error: 'You must moderate both Societies' }, { status: 403 });

  let folderId: string | null = null;
  if (b.targetFolderId) {
    if (!UUID.test(b.targetFolderId)) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    const { rows } = await pool.query('SELECT 1 FROM document_folders WHERE id = $1 AND customer_id = $2', [b.targetFolderId, target]);
    if (!rows.length) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    folderId = b.targetFolderId;
  }

  // Everything must belong to the source Society
  for (const it of items) {
    const { rows } = await pool.query(
      it.type === 'doc' ? 'SELECT 1 FROM documents WHERE id = $1 AND customer_id = $2 AND deleted_at IS NULL'
                        : 'SELECT 1 FROM document_folders WHERE id = $1 AND customer_id = $2',
      [it.id, a.societyId]);
    if (!rows.length) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    // Within this Society, a folder can't go inside itself or one of its own sub-folders
    if (it.type === 'folder' && target === a.societyId && folderId) {
      const { rows: inside } = await pool.query(
        `WITH RECURSIVE down AS (SELECT id FROM document_folders WHERE id = $1
           UNION ALL SELECT f.id FROM document_folders f JOIN down ON f.parent_id = down.id)
         SELECT 1 FROM down WHERE id = $2`, [it.id, folderId]);
      if (inside.length) return NextResponse.json({ error: 'A folder can’t go inside itself or one of its own sub-folders' }, { status: 400 });
    }
  }

  // Sealed folders and documents can only be re-encrypted in a browser, so they can't be moved or copied here
  const sealedMsg = NextResponse.json({ error: 'Sealed folders and documents can’t be moved or copied. Download them and upload them where you want them.' }, { status: 409 });
  if (folderId && await sealRootOf(target, folderId)) return sealedMsg;
  const roots = await sealRoots(a.societyId);
  for (const it of items) {
    if (it.type === 'doc') {
      const { rows: [d] } = await pool.query('SELECT folder_id, protection FROM documents WHERE id = $1', [it.id]);
      if (d.protection === 'sealed' || (d.folder_id && roots.get(d.folder_id))) return sealedMsg;
    } else {
      const tree = await folderTree(a.societyId, it.id);
      if (tree.some(f => roots.get(f))) return sealedMsg;
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const it of items) {
      if (it.type === 'doc') await transferDocument(client, it.id, target, folderId, mode);
      else await transferFolder(client, it.id, target, folderId, mode);
    }
    await client.query('COMMIT');
    return NextResponse.json({ ok: true, count: items.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('document transfer failed:', err);
    return NextResponse.json({ error: `The ${mode} failed; nothing was changed` }, { status: 500 });
  } finally {
    client.release();
  }
}

export const POST = lockSafe(handlePOST);
