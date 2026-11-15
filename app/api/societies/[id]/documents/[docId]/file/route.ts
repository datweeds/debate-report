import { NextRequest, NextResponse } from 'next/server';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { INLINE_TYPES, storedPath } from '@/lib/documents';

type Params = { params: Promise<{ id: string; docId: string }> };

// GET — the file, if the viewer can see the Society. Opens in the browser for
// safe types (PDF, images, plain text); ?download=1, or any other type, saves it.
// Each open or download is counted.
export async function GET(req: NextRequest, { params }: Params) {
  const { id, docId } = await params;
  const a = await societyContentAccess(req, id);
  if (!a || !/^[0-9a-f-]{36}$/i.test(docId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { rows: [d] } = await pool.query(
    `SELECT stored_name, file_name, mime_type FROM documents
     WHERE id = $1 AND customer_id = $2 AND kind = 'file' AND deleted_at IS NULL`,
    [docId, a.societyId],
  );
  if (!d?.stored_name) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const file = storedPath(a.societyId, d.stored_name);
  const info = await stat(file).catch(() => null);
  if (!info) return NextResponse.json({ error: 'File missing' }, { status: 404 });

  const inline = INLINE_TYPES.has(d.mime_type) && req.nextUrl.searchParams.get('download') !== '1';
  await pool.query(
    `UPDATE documents SET ${inline ? 'open_count = open_count + 1' : 'download_count = download_count + 1'} WHERE id = $1`,
    [docId],
  );

  const ascii = d.file_name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return new NextResponse(Readable.toWeb(createReadStream(file)) as ReadableStream, {
    headers: {
      'Content-Type': inline ? d.mime_type : 'application/octet-stream',
      'Content-Length': String(info.size),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(d.file_name)}`,
      'X-Content-Type-Options': 'nosniff',
      // Images and text can't run scripts or load anything. (Not applied to
      // PDFs: Chrome refuses to show a PDF under a sandbox policy, and its
      // viewer doesn't run document scripts on our site.)
      ...(d.mime_type === 'application/pdf' ? {} : { 'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'" }),
      'Cache-Control': 'private, no-store',
    },
  });
}
