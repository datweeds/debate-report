import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sealText } from '@/lib/societyCrypto';
import { societyContentAccess } from '@/lib/societies';
import { lockSafe } from '@/lib/lockSafe';
import { allowsSealed, firstLocks, readLocks } from '@/lib/sealed/server';
import { folderTree, sealRootOf, sealRoots } from '@/lib/sealed/folders';

type Params = { params: Promise<{ id: string; folderId: string }> };

// POST — a moderator seals or unseals a folder and everything below it.
//   { action: 'seal', locks, names: [{ id, name }] } — the folder and its
//     sub-folders' names, sealed for epoch 1 of this folder. Its documents are
//     then converted one by one (documents/<id>/seal), from the browser.
//   { action: 'unseal', names: [{ id, name }] } — plain names; every document in
//     it must already have been converted back.
async function handlePOST(req: NextRequest, { params }: Params) {
  const { id, folderId } = await params;
  const a = await societyContentAccess(req, id);
  if (!a?.session || !/^[0-9a-f-]{36}$/i.test(folderId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate || !a.isMember) return NextResponse.json({ error: 'Only the Society’s admins can do this' }, { status: 403 });
  const { rows: [f] } = await pool.query('SELECT protection FROM document_folders WHERE id = $1 AND customer_id = $2', [folderId, a.societyId]);
  if (!f) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const tree = await folderTree(a.societyId, folderId);
  const names: { id: string; name?: unknown }[] = Array.isArray(b.names) ? b.names : [];
  if (tree.length !== names.length || !tree.every(t => names.some(n => n.id === t))) {
    return NextResponse.json({ error: 'The folders changed while this was happening: try again' }, { status: 409 });
  }
  const client = await pool.connect();
  const fail = async (status: number, error: string) => { await client.query('ROLLBACK'); return NextResponse.json({ error }, { status }); };
  try {
    await client.query('BEGIN');
    if (b.action === 'seal') {
      if (await sealRootOf(a.societyId, folderId)) return fail(409, 'It’s already sealed, or inside a sealed folder');
      const roots = await sealRoots(a.societyId);
      if (tree.some(t => roots.get(t))) return fail(409, 'A folder inside it is already sealed');
      if (!await allowsSealed(a.societyId)) return fail(403, 'This Society doesn’t allow Sealed items');
      const locks = readLocks(b.locks);
      const isE2E = (v: unknown) => typeof v === 'string' && v.length <= 2000 && /^sn1:1:[A-Za-z0-9+/]+={0,2}$/.test(v);
      if (!locks || !names.every(n => isE2E(n.name))) return fail(400, 'Every folder name must be sealed');
      await client.query(`UPDATE document_folders SET protection = 'sealed', sealed_epoch = 1 WHERE id = $1`, [folderId]);
      const problem = await firstLocks(client, { type: 'folder', id: folderId, societyId: a.societyId, epoch: 1 }, a.session.sub, locks);
      if (problem) return fail(400, problem);
      for (const n of names) await client.query('UPDATE document_folders SET name = $1 WHERE id = $2', [n.name, n.id]);
    } else if (b.action === 'unseal') {
      if (f.protection !== 'sealed') return fail(409, 'It isn’t sealed');
      const { rows: [left] } = await client.query(
        `SELECT count(*)::int AS n FROM documents WHERE folder_id = ANY($1::uuid[]) AND protection = 'sealed' AND deleted_at IS NULL`, [tree]);
      if (left.n) return fail(409, `${left.n} document${left.n === 1 ? ' is' : 's are'} still sealed: unseal them first`);
      for (const n of names) {
        if (typeof n.name !== 'string' || !n.name.trim() || n.name.startsWith('sn1:')) return fail(400, 'Every folder name must be plain');
        await client.query('UPDATE document_folders SET name = $1 WHERE id = $2', [await sealText(a.societyId, n.name.trim().slice(0, 120)), n.id]);
      }
      await client.query(`UPDATE document_folders SET protection = 'server', sealed_epoch = NULL WHERE id = $1`, [folderId]);
      await client.query(`DELETE FROM sealed_item_keys WHERE item_type = 'folder' AND item_id = $1`, [folderId]);
    } else return fail(400, 'Unknown action');
    await client.query('COMMIT');
    return NextResponse.json({ ok: true });
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
}

export const POST = lockSafe(handlePOST);
