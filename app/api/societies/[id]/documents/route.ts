import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { openRows, sealText } from '@/lib/societyCrypto';
import { societyContentAccess } from '@/lib/societies';
import { MEMBER_LIMIT_BYTES, MODERATOR_LIMIT_BYTES, formatBytes, isHttpUrl, saveFile } from '@/lib/documents';
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
      `SELECT d.id, d.kind, d.title, d.description, d.url, d.file_name, d.mime_type, d.size_bytes,
              d.created_at, d.open_count, d.download_count, d.uploaded_by, u.user_handle AS uploader
       FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE d.customer_id = $1 AND d.folder_id IS NOT DISTINCT FROM $2 AND d.deleted_at IS NULL
       ORDER BY d.created_at DESC`, [a.societyId, folderId]),
  ]);
  await openRows(a.societyId, items, ['title', 'description', 'url', 'file_name']);
  await openRows(a.societyId, path, ['name']);
  await openRows(a.societyId, folders, ['name']);
  folders.sort((x, y) => String(x.name).localeCompare(String(y.name)));
  const limit = a.canModerate ? MODERATOR_LIMIT_BYTES : MEMBER_LIMIT_BYTES;
  return NextResponse.json({
    folderId, path, folders, items,
    me: a.session?.sub ?? null,
    canPost: a.canPost, canModerate: a.canModerate, canTakeDown: a.canTakeDown,
    maxBytes: limit, maxLabel: formatBytes(limit),
  });
}

// POST — multipart { file, title?, description?, folderId? } to upload, or
// JSON { url, title, description?, folderId? } to add a link.
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
    const title = String(form.get('title') ?? '').trim() || file.name;
    const description = String(form.get('description') ?? '').trim() || null;
    const { storedName } = await saveFile(a.societyId, file);
    const { rows: [d] } = await pool.query(
      `INSERT INTO documents (customer_id, folder_id, kind, title, description, file_name, stored_name, mime_type, size_bytes, uploaded_by)
       VALUES ($1, $2, 'file', $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [a.societyId, folderId, await sealText(a.societyId, title.slice(0, 200)), await sealText(a.societyId, description?.slice(0, 2000) ?? null),
       await sealText(a.societyId, file.name.slice(0, 255)), storedName, file.type || 'application/octet-stream', file.size, a.session!.sub],
    );
    return NextResponse.json({ id: d.id }, { status: 201 });
  }

  const { url, title, description, folderId: rawFolder } = await req.json().catch(() => ({}));
  if (!isHttpUrl(url)) return NextResponse.json({ error: 'Enter a web address starting with http:// or https://' }, { status: 400 });
  const folderId = await folderInSociety(a.societyId, rawFolder);
  if (folderId === false) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
  const name = typeof title === 'string' && title.trim() ? title.trim() : new URL(url).hostname;
  const { rows: [d] } = await pool.query(
    `INSERT INTO documents (customer_id, folder_id, kind, title, description, url, uploaded_by)
     VALUES ($1, $2, 'link', $3, $4, $5, $6) RETURNING id`,
    [a.societyId, folderId, await sealText(a.societyId, name.slice(0, 200)),
     await sealText(a.societyId, typeof description === 'string' && description.trim() ? description.trim().slice(0, 2000) : null),
     await sealText(a.societyId, url), a.session!.sub],
  );
  return NextResponse.json({ id: d.id }, { status: 201 });
}

export const POST = lockSafe(handlePOST);
