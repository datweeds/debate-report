import { NextRequest, NextResponse } from 'next/server';
import { screenImageUpload } from '@/lib/imageScan';
import pool from '@/lib/db';
import { sealText } from '@/lib/societyCrypto';
import { societyContentAccess } from '@/lib/societies';
import { NOTE_MAX_CHARS, NOTE_SEALED_MAX, isBrowserSealed, isHttpUrl, removeFile, saveFile, saveSealedBytes } from '@/lib/documents';
import { lockSafe } from '@/lib/lockSafe';
import { sealedFor } from '@/lib/sealed/server';
import { sealRootOf } from '@/lib/sealed/folders';

type Params = { params: Promise<{ id: string; docId: string }> };

// POST — a moderator converts one document while its folder is sealed or unsealed.
// The browser sends its new details (and file), encrypted for 'seal' or plain for 'unseal':
//   multipart { action, title, description?, fileName, file }  for a file
//   JSON      { action, title, description?, url }              for a link
//   JSON      { action, title, body? }                          for a note
async function handlePOST(req: NextRequest, { params }: Params) {
  const { id, docId } = await params;
  const a = await societyContentAccess(req, id);
  if (!a?.session || !/^[0-9a-f-]{36}$/i.test(docId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate || !a.isMember) return NextResponse.json({ error: 'Only the Society’s admins can do this' }, { status: 403 });
  const { rows: [d] } = await pool.query(
    `SELECT id, kind, folder_id, stored_name, protection FROM documents WHERE id = $1 AND customer_id = $2 AND deleted_at IS NULL`, [docId, a.societyId]);
  if (!d) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const root = await sealRootOf(a.societyId, d.folder_id);

  const multipart = (req.headers.get('content-type') ?? '').includes('multipart/form-data');
  const form = multipart ? await req.formData() : null;
  const json = multipart ? null : await req.json().catch(() => ({}));
  const get = (k: string) => (form ? form.get(k) : json?.[k]) as unknown;
  const action = get('action');
  if (action !== 'seal' && action !== 'unseal') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  // Seal: the folder must be sealed and this document not yet. Unseal: the other way round.
  if (action === 'seal' ? !root || d.protection === 'sealed' : d.protection !== 'sealed') {
    return NextResponse.json({ error: action === 'seal' ? 'Nothing to seal here' : 'It isn’t sealed' }, { status: 409 });
  }
  const sealing = action === 'seal';
  const ok = (v: unknown, required: boolean) =>
    v == null || v === '' ? !required : sealing ? sealedFor(root!, v, 30000) : typeof v === 'string' && !v.startsWith('sn1:');
  const title = get('title'), description = get('description');
  if (!ok(title, true) || !ok(description, false)) return NextResponse.json({ error: 'That wasn’t understood' }, { status: 400 });
  const plain = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

  if (d.kind === 'note') {
    const nb = get('body');
    const fits = nb == null || nb === '' || (sealing ? sealedFor(root!, nb, NOTE_SEALED_MAX) : typeof nb === 'string' && !nb.startsWith('sn1:') && nb.length <= NOTE_MAX_CHARS);
    if (!fits) return NextResponse.json({ error: 'That wasn’t understood' }, { status: 400 });
    await pool.query(`UPDATE documents SET title = $1, body = $2, protection = $3, updated_at = now() WHERE id = $4`, sealing
      ? [title, nb || null, 'sealed', docId]
      : [await sealText(a.societyId, plain(title, 200)), await sealText(a.societyId, typeof nb === 'string' && nb ? nb : null), 'server', docId]);
    return NextResponse.json({ ok: true });
  }

  if (d.kind === 'link') {
    const url = get('url');
    if (sealing ? !sealedFor(root!, url, 30000) : !isHttpUrl(url)) return NextResponse.json({ error: 'That wasn’t understood' }, { status: 400 });
    await pool.query(`UPDATE documents SET title = $1, description = $2, url = $3, protection = $4, updated_at = now() WHERE id = $5`, sealing
      ? [title, description || null, url, 'sealed', docId]
      : [await sealText(a.societyId, plain(title, 200)), await sealText(a.societyId, plain(description, 2000)), await sealText(a.societyId, url as string), 'server', docId]);
    return NextResponse.json({ ok: true });
  }

  const file = get('file'), fileName = get('fileName');
  if (!(file instanceof File) || !ok(fileName, true)) return NextResponse.json({ error: 'That wasn’t understood' }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  if (sealing !== isBrowserSealed(bytes)) return NextResponse.json({ error: 'That file wasn’t understood' }, { status: 400 });
  if (!sealing) {
    // Unsealed again: an image is checked like any new upload
    const screen = await screenImageUpload({ bytes: Buffer.from(await file.arrayBuffer()), mime: file.type, fileName: file.name,
      userId: a.session!.sub, societyId: a.societyId, where: 'Society document (unsealed)' });
    if (!screen.ok) return NextResponse.json({ error: screen.error }, { status: 422 });
  }
  const { storedName } = sealing ? await saveSealedBytes(a.societyId, bytes) : await saveFile(a.societyId, file);
  await pool.query(
    `UPDATE documents SET title = $1, description = $2, file_name = $3, stored_name = $4, size_bytes = $5, protection = $6, updated_at = now() WHERE id = $7`,
    sealing
      ? [title, description || null, fileName, storedName, bytes.length, 'sealed', docId]
      : [await sealText(a.societyId, plain(title, 200)), await sealText(a.societyId, plain(description, 2000)), await sealText(a.societyId, plain(fileName, 255)),
         storedName, bytes.length, 'server', docId]);
  await removeFile(a.societyId, d.stored_name);
  return NextResponse.json({ ok: true });
}

export const POST = lockSafe(handlePOST);
