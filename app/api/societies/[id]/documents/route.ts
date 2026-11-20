import { NextRequest, NextResponse } from 'next/server';
import { hideEndToEnd } from '@/lib/societyCrypto';
import { allowsSealed, sealedFor } from '@/lib/sealed/server';
import { folderTree, sealRootOf, sealRoots } from '@/lib/sealed/folders';
import { notifyNew } from '@/lib/notify';
import pool from '@/lib/db';
import { openRows, sealText } from '@/lib/societyCrypto';
import { societyContentAccess } from '@/lib/societies';
import { MEMBER_LIMIT_BYTES, MODERATOR_LIMIT_BYTES, NOTE_MAX_CHARS, NOTE_SEALED_MAX, formatBytes, isHttpUrl, saveFile, isBrowserSealed, saveSealedBytes } from '@/lib/documents';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

async function folderInSociety(societyId: number, folderId: unknown): Promise<string | null | false> {
  if (folderId == null || folderId === '' || folderId === 'root') return null;
  if (typeof folderId !== 'string' || !UUID.test(folderId)) return false;
  const { rows } = await pool.query('SELECT 1 FROM document_folders WHERE id = $1 AND customer_id = $2', [folderId, societyId]);
  return rows.length ? folderId : false;
}

// GET ?folder=<id> — a folder's sub-folders and items, with the path to it.
export async function GET(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // ?all=1 — every document, with its folder path, for pickers (e.g. a project task's document)
  if (req.nextUrl.searchParams.get('all') === '1') {
    const [{ rows: docs }, { rows: folders }] = await Promise.all([
      pool.query(`SELECT id, kind, title, file_name, mime_type, folder_id FROM documents WHERE customer_id = $1 AND deleted_at IS NULL`, [a.societyId]),
      pool.query(`SELECT id, parent_id, name FROM document_folders WHERE customer_id = $1`, [a.societyId]),
    ]);
    await openRows(a.societyId, docs, ['title', 'file_name']);
    await openRows(a.societyId, folders, ['name']);
    // Sealed folders' names and documents can't be read here
    await hideEndToEnd(docs); await hideEndToEnd(folders);
    const byId = new Map(folders.map(f => [f.id as string, f]));
    const pathOf = (fid: string | null): string => {
      const names: string[] = [];
      for (let f = fid ? byId.get(fid) : undefined, n = 0; f && n < 20; f = f.parent_id ? byId.get(f.parent_id) : undefined, n++) names.unshift(String(f.name));
      return names.join(' / ');
    };
    const list = docs.map(d => ({ id: d.id, kind: d.kind, title: d.title, file_name: d.file_name, mime_type: d.mime_type, folder: pathOf(d.folder_id) }))
      .sort((x, y) => x.folder.localeCompare(y.folder) || String(x.title).localeCompare(String(y.title)));
    return NextResponse.json({ documents: list });
  }
  // ?tree=<id> (moderators, to seal or unseal a folder): every document in it and below it
  const tree = req.nextUrl.searchParams.get('tree');
  if (tree && a.canModerate && UUID.test(tree)) {
    const { rows: docs } = await pool.query(
      `SELECT id, kind, title, description, url, file_name, body, mime_type, folder_id, protection FROM documents
       WHERE folder_id = ANY($1::uuid[]) AND customer_id = $2 AND deleted_at IS NULL`, [await folderTree(a.societyId, tree), a.societyId]);
    await openRows(a.societyId, docs, ['title', 'description', 'url', 'file_name', 'body']);
    return NextResponse.json({ documents: docs });
  }
  const folderId = await folderInSociety(a.societyId, req.nextUrl.searchParams.get('folder'));
  if (folderId === false) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });

  const [{ rows: path }, { rows: folders }, { rows: items }] = await Promise.all([
    folderId
      ? pool.query(
          `WITH RECURSIVE up AS (
             SELECT id, parent_id, name, 0 AS depth FROM document_folders WHERE id = $1
             UNION ALL SELECT f.id, f.parent_id, f.name, up.depth + 1 FROM document_folders f JOIN up ON f.id = up.parent_id)
           SELECT id, name FROM up ORDER BY depth DESC`, [folderId])
      : Promise.resolve({ rows: [] }),
    pool.query(
      `SELECT f.id, f.name, f.created_at,
              (SELECT COUNT(*)::int FROM documents d WHERE d.folder_id = f.id AND d.deleted_at IS NULL)
            + (SELECT COUNT(*)::int FROM document_folders c WHERE c.parent_id = f.id) AS item_count
       FROM document_folders f
       WHERE f.customer_id = $1 AND f.parent_id IS NOT DISTINCT FROM $2`, [a.societyId, folderId]),
    pool.query(
      `SELECT d.id, d.kind, d.title, d.description, d.url, d.file_name, d.mime_type, d.size_bytes, d.protection,
              d.created_at, d.open_count, d.download_count, d.uploaded_by, u.user_handle AS uploader
       FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE d.customer_id = $1 AND d.folder_id IS NOT DISTINCT FROM $2 AND d.deleted_at IS NULL
       ORDER BY d.created_at DESC`, [a.societyId, folderId]),
  ]);
  await openRows(a.societyId, items, ['title', 'description', 'url', 'file_name']);
  await openRows(a.societyId, path, ['name']);
  await openRows(a.societyId, folders, ['name']);
  folders.sort((x, y) => String(x.name).localeCompare(String(y.name)));
  // Sealed folders: each name and document says which sealed folder's key opens it
  const roots = await sealRoots(a.societyId);
  const rootId = (fid: string | null) => (fid ? roots.get(fid)?.id ?? null : null);
  for (const p of path) p.seal_root = rootId(p.id);
  for (const f of folders) f.seal_root = rootId(f.id);
  const here = folderId ? roots.get(folderId) ?? null : null;
  for (const i of items) i.seal_root = here?.id ?? null;
  // Still being sealed: documents in this sealed folder not yet converted
  let pending = 0;
  if (here) {
    const tree = await folderTree(a.societyId, here.id);
    const { rows: [n] } = await pool.query(
      `SELECT count(*)::int AS n FROM documents WHERE folder_id = ANY($1::uuid[]) AND protection = 'server' AND deleted_at IS NULL`, [tree]);
    pending = n.n;
  }
  const limit = a.canModerate ? MODERATOR_LIMIT_BYTES : MEMBER_LIMIT_BYTES;
  return NextResponse.json({
    folderId, path, folders, items,
    sealed: here ? { id: here.id, epoch: here.epoch, pending } : null,
    canSeal: a.canModerate && a.isMember && await allowsSealed(a.societyId),
    me: a.session?.sub ?? null,
    canPost: a.canPost, canModerate: a.canModerate, canTakeDown: a.canTakeDown,
    maxBytes: limit, maxLabel: formatBytes(limit),
  });
}

// POST — multipart { file, title?, description?, folderId? } to upload, or
// JSON { url, title, description?, folderId? } to add a link, or
// JSON { kind: 'note', title, body, folderId? } to write a note (body is HTML).
async function handlePOST(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canPost) return NextResponse.json({ error: 'Join this Society to add documents' }, { status: 403 });
  const limit = a.canModerate ? MODERATOR_LIMIT_BYTES : MEMBER_LIMIT_BYTES;

  if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Choose a file to upload' }, { status: 400 });
    if (file.size > limit) {
      return NextResponse.json({ error: `Files can be up to ${formatBytes(limit)}. For anything larger, add a link to where it's stored instead.` }, { status: 413 });
    }
    const folderId = await folderInSociety(a.societyId, form.get('folderId'));
    if (folderId === false) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    // A sealed folder: the file and its details arrive encrypted in the browser, kept as they are
    const root = await sealRootOf(a.societyId, folderId);
    if (root) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const [title, description, fileName] = [form.get('title'), form.get('description'), form.get('fileName')];
      const mime = String(form.get('mime') ?? '').slice(0, 120) || 'application/octet-stream';
      if (!isBrowserSealed(bytes) || !sealedFor(root, title, 30000) || !sealedFor(root, fileName, 30000) || !(description == null || description === '' || sealedFor(root, description, 30000))) {
        return NextResponse.json({ error: 'This sealed folder’s keys have changed: reload the page and try again' }, { status: 400 });
      }
      const { storedName } = await saveSealedBytes(a.societyId, bytes);
      const { rows: [d] } = await pool.query(
        `INSERT INTO documents (customer_id, folder_id, kind, title, description, file_name, stored_name, mime_type, size_bytes, uploaded_by, protection)
         VALUES ($1, $2, 'file', $3, $4, $5, $6, $7, $8, $9, 'sealed') RETURNING id`,
        [a.societyId, folderId, title, description || null, fileName, storedName, mime, bytes.length, a.session!.sub]);
      notifyNew({ societyId: a.societyId, kind: 'documents', authorId: a.session!.sub, private: true, url: `/society/${a.societyId}/documents?folder=${folderId}` });
      return NextResponse.json({ id: d.id }, { status: 201 });
    }
    const title = String(form.get('title') ?? '').trim() || file.name;
    const description = String(form.get('description') ?? '').trim() || null;
    const { storedName } = await saveFile(a.societyId, file);
    const { rows: [d] } = await pool.query(
      `INSERT INTO documents (customer_id, folder_id, kind, title, description, file_name, stored_name, mime_type, size_bytes, uploaded_by)
       VALUES ($1, $2, 'file', $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [a.societyId, folderId, await sealText(a.societyId, title.slice(0, 200)), await sealText(a.societyId, description?.slice(0, 2000) ?? null),
       await sealText(a.societyId, file.name.slice(0, 255)), storedName, file.type || 'application/octet-stream', file.size, a.session!.sub],
    );
    notifyNew({ societyId: a.societyId, kind: 'documents', authorId: a.session!.sub, title, url: `/society/${a.societyId}/documents` });
    return NextResponse.json({ id: d.id }, { status: 201 });
  }

  const json = await req.json().catch(() => ({}));
  if (json?.kind === 'note') {
    const folderId = await folderInSociety(a.societyId, json.folderId);
    if (folderId === false) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    // A sealed folder: the note's title and text arrive encrypted
    const root = await sealRootOf(a.societyId, folderId);
    if (root) {
      if (!sealedFor(root, json.title, 30000) || !(json.body == null || json.body === '' || sealedFor(root, json.body, NOTE_SEALED_MAX))) {
        return NextResponse.json({ error: 'This sealed folder’s keys have changed: reload the page and try again' }, { status: 400 });
      }
      const { rows: [d] } = await pool.query(
        `INSERT INTO documents (customer_id, folder_id, kind, title, body, uploaded_by, protection) VALUES ($1, $2, 'note', $3, $4, $5, 'sealed') RETURNING id`,
        [a.societyId, folderId, json.title, json.body || null, a.session!.sub]);
      notifyNew({ societyId: a.societyId, kind: 'documents', authorId: a.session!.sub, private: true, url: `/society/${a.societyId}/documents?folder=${folderId}` });
      return NextResponse.json({ id: d.id }, { status: 201 });
    }
    const title = typeof json.title === 'string' ? json.title.trim() : '';
    const body = typeof json.body === 'string' ? json.body : '';
    if (!title) return NextResponse.json({ error: 'Give the note a title' }, { status: 400 });
    if (title.startsWith('sn1:') || body.startsWith('sn1:')) return NextResponse.json({ error: 'This folder isn’t sealed: reload the page' }, { status: 400 });
    if (body.length > NOTE_MAX_CHARS) return NextResponse.json({ error: 'This note is too long. Split it into two notes, or upload it as a file.' }, { status: 413 });
    const { rows: [d] } = await pool.query(
      `INSERT INTO documents (customer_id, folder_id, kind, title, body, uploaded_by) VALUES ($1, $2, 'note', $3, $4, $5) RETURNING id`,
      [a.societyId, folderId, await sealText(a.societyId, title.slice(0, 200)), await sealText(a.societyId, body || null), a.session!.sub]);
    notifyNew({ societyId: a.societyId, kind: 'documents', authorId: a.session!.sub, title, url: `/society/${a.societyId}/documents?note=${d.id}` });
    return NextResponse.json({ id: d.id }, { status: 201 });
  }
  const { url, title, description, folderId: rawFolder } = json;
  const folderId = await folderInSociety(a.societyId, rawFolder);
  if (folderId === false) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
  // A sealed folder: the link's address and details arrive encrypted
  const root = await sealRootOf(a.societyId, folderId);
  if (root) {
    if (!sealedFor(root, url, 30000) || !sealedFor(root, title, 30000) || !(description == null || description === '' || sealedFor(root, description, 30000))) {
      return NextResponse.json({ error: 'This sealed folder’s keys have changed: reload the page and try again' }, { status: 400 });
    }
    const { rows: [d] } = await pool.query(
      `INSERT INTO documents (customer_id, folder_id, kind, title, description, url, uploaded_by, protection) VALUES ($1, $2, 'link', $3, $4, $5, $6, 'sealed') RETURNING id`,
      [a.societyId, folderId, title, description || null, url, a.session!.sub]);
    notifyNew({ societyId: a.societyId, kind: 'documents', authorId: a.session!.sub, private: true, url: `/society/${a.societyId}/documents?folder=${folderId}` });
    return NextResponse.json({ id: d.id }, { status: 201 });
  }
  if (!isHttpUrl(url)) return NextResponse.json({ error: 'Enter a web address starting with http:// or https://' }, { status: 400 });
  const name = typeof title === 'string' && title.trim() ? title.trim() : new URL(url).hostname;
  const { rows: [d] } = await pool.query(
    `INSERT INTO documents (customer_id, folder_id, kind, title, description, url, uploaded_by)
     VALUES ($1, $2, 'link', $3, $4, $5, $6) RETURNING id`,
    [a.societyId, folderId, await sealText(a.societyId, name.slice(0, 200)),
     await sealText(a.societyId, typeof description === 'string' && description.trim() ? description.trim().slice(0, 2000) : null),
     await sealText(a.societyId, url), a.session!.sub],
  );
  notifyNew({ societyId: a.societyId, kind: 'documents', authorId: a.session!.sub, title: name, url: `/society/${a.societyId}/documents` });
  return NextResponse.json({ id: d.id }, { status: 201 });
}

export const POST = lockSafe(handlePOST);
