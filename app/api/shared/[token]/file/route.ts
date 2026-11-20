import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import pool from '@/lib/db';
import { fileIsSealed, openFile, openText } from '@/lib/societyCrypto';
import { INLINE_TYPES, storedPath } from '@/lib/documents';
import { shareByToken, shareState } from '@/lib/documentShares';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ token: string }> };

// GET — the shared file (no account needed). A public link gets the document
// itself (opened in the browser for safe types; ?download=1 saves it); a
// private link gets its encrypted copy, opened in the recipient's browser.
async function handleGET(req: NextRequest, { params }: Params) {
  const s = await shareByToken((await params).token);
  if (!s || shareState(s) !== 'ok') return NextResponse.json({ error: 'This link has expired or been revoked' }, { status: 404 });
  const name = s.mode === 'private' ? s.stored_name : s.doc_stored_name;
  const data = name ? await readFile(storedPath(s.customer_id, name)).catch(() => null) : null;
  if (!data) return NextResponse.json({ error: 'File missing' }, { status: 404 });
  await pool.query('UPDATE document_shares SET open_count = open_count + 1, last_opened_at = now() WHERE id = $1', [s.id]);

  if (s.mode === 'private') {
    return new NextResponse(new Uint8Array(data), {
      headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(data.length), 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' },
    });
  }
  const plain = fileIsSealed(data.subarray(0, 8)) ? await openFile(s.customer_id, data) : data;
  const inline = INLINE_TYPES.has(s.mime_type ?? '') && req.nextUrl.searchParams.get('download') !== '1';
  const fileName = (await openText(s.customer_id, s.file_name)) || 'document';
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return new NextResponse(new Uint8Array(plain), {
    headers: {
      'Content-Type': inline ? s.mime_type! : 'application/octet-stream',
      'Content-Length': String(plain.length),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'X-Content-Type-Options': 'nosniff',
      ...(s.mime_type === 'application/pdf' ? {} : { 'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'" }),
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex',
      'Cache-Control': 'private, no-store',
    },
  });
}

export const GET = lockSafe(handleGET);
