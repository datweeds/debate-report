import { NextRequest, NextResponse } from 'next/server';
import { hideEndToEnd, openRows } from '@/lib/societyCrypto';
import { allowsSealed, firstLocks, readLocks, sealedFor, UUID_RE_SEALED } from '@/lib/sealed/server';
import { folderTree, sealRootOf, sealRoots } from '@/lib/sealed/folders';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { sealText } from '@/lib/societyCrypto';
import { folderPaths } from '@/lib/folders';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string }> };

// GET — every folder in the Society (for "move to folder" pickers), as a flat list.
export async function GET(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // ?tree=<id> (moderators, to seal or unseal it): that folder and every folder below it, by name
  const tree = req.nextUrl.searchParams.get('tree');
  if (tree && a.canModerate && /^[0-9a-f-]{36}$/i.test(tree)) {
    const ids = await folderTree(a.societyId, tree);
    const { rows } = await pool.query('SELECT id, name FROM document_folders WHERE id = ANY($1::uuid[])', [ids]);
    await openRows(a.societyId, rows, ['name']);
    return NextResponse.json({ folders: rows });
  }
  // Sealed folders' names can't be read here, and nothing can be moved into them
  const roots = await sealRoots(a.societyId);
  const folders = (await folderPaths([a.societyId])).map(f => ({ id: f.id, full_path: f.full_path, sealed: !!roots.get(f.id) }));
  await hideEndToEnd(folders);
  return NextResponse.json({ folders });
}

// POST { name, parentId? } — moderators build the folder structure. Inside a
// sealed folder the name arrives sealed. A new sealed folder:
// { protection: 'sealed', id, name (sealed with its own new key), locks, parentId? }.
async function handlePOST(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Only moderators can create folders' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const { name, parentId } = b;
  if (typeof name !== 'string' || !name.trim()) return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
  let parent: string | null = null;
  if (typeof parentId === 'string' && /^[0-9a-f-]{36}$/i.test(parentId)) {
    const { rows } = await pool.query('SELECT 1 FROM document_folders WHERE id = $1 AND customer_id = $2', [parentId, a.societyId]);
    if (!rows.length) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    parent = parentId;
  }
  const root = await sealRootOf(a.societyId, parent);
  if (b.protection === 'sealed') {
    if (root) return NextResponse.json({ error: 'This folder is already inside a sealed folder' }, { status: 400 });
    if (!a.isMember || !await allowsSealed(a.societyId)) return NextResponse.json({ error: 'This Society doesn’t allow Sealed folders' }, { status: 403 });
    const locks = readLocks(b.locks);
    const item = { type: 'folder' as const, id: String(b.id), societyId: a.societyId, epoch: 1 };
    if (!UUID_RE_SEALED.test(item.id) || !locks || !sealedFor(item, name, 2000)) return NextResponse.json({ error: 'That sealed folder wasn’t understood' }, { status: 400 });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`INSERT INTO document_folders (id, customer_id, parent_id, name, created_by, protection, sealed_epoch) VALUES ($1, $2, $3, $4, $5, 'sealed', 1)`,
        [item.id, a.societyId, parent, name, a.session!.sub]);
      const problem = await firstLocks(client, item, a.session!.sub, locks);
      if (problem) { await client.query('ROLLBACK'); return NextResponse.json({ error: problem }, { status: 400 }); }
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
    return NextResponse.json({ id: item.id }, { status: 201 });
  }
  if (root ? !sealedFor(root, name, 2000) : name.startsWith('sn1:')) {
    return NextResponse.json({ error: root ? 'This sealed folder’s keys have changed: reload the page and try again' : 'This folder isn’t sealed' }, { status: 400 });
  }
  const { rows: [f] } = await pool.query(
    'INSERT INTO document_folders (customer_id, parent_id, name, created_by) VALUES ($1, $2, $3, $4) RETURNING id',
    [a.societyId, parent, root ? name : await sealText(a.societyId, name.trim().slice(0, 120)), a.session!.sub],
  );
  return NextResponse.json({ id: f.id }, { status: 201 });
}

export const POST = lockSafe(handlePOST);
