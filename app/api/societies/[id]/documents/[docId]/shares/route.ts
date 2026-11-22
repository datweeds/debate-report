import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { MODERATOR_LIMIT_BYTES, storedPath } from '@/lib/documents';
import { expiryFor, hashToken, newToken, shareState, type ShareMode } from '@/lib/documentShares';
import { isShareCopy } from '@/lib/sealed/shareLink';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string; docId: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

async function moderatorDoc(req: NextRequest, id: string, docId: string) {
  const a = await societyContentAccess(req, id);
  if (!a || !UUID.test(docId)) return null;
  const { rows: [d] } = await pool.query(
    `SELECT d.id, d.kind, d.protection, c.visibility FROM documents d JOIN customers c ON c.id = d.customer_id
      WHERE d.id = $1 AND d.customer_id = $2 AND d.deleted_at IS NULL`,
    [docId, a.societyId],
  );
  return d ? { a, d } : null;
}

// GET — a document's share links (moderators).
export async function GET(req: NextRequest, { params }: Params) {
  const { id, docId } = await params;
  const m = await moderatorDoc(req, id, docId);
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!m.a.canModerate) return NextResponse.json({ error: 'Only Society Admins can share documents' }, { status: 403 });
  const { rows } = await pool.query(
    `SELECT s.id, s.mode, s.created_at, s.expires_at, s.extended_at, s.open_count, s.last_opened_at, u.user_handle AS created_by
       FROM document_shares s LEFT JOIN users u ON u.id = s.created_by
      WHERE s.document_id = $1 AND s.revoked_at IS NULL ORDER BY s.created_at DESC`,
    [docId],
  );
  return NextResponse.json({
    shares: rows.map(s => ({ ...s, state: shareState({ ...s, visibility: m.d.visibility, protection: m.d.protection }) })),
    privateSociety: m.d.visibility !== 'public',
    sealed: m.d.protection === 'sealed',
  });
}

// POST — a new link (moderators). JSON { mode: 'public', days } or, for a
// private link, multipart { mode: 'private', days, copy } where copy is the
// document encrypted in the browser. Returns the token once: only its hash is kept.
async function handlePOST(req: NextRequest, { params }: Params) {
  const { id, docId } = await params;
  const m = await moderatorDoc(req, id, docId);
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { a, d } = m;
  if (!a.canModerate) return NextResponse.json({ error: 'Only Society Admins can share documents' }, { status: 403 });
  if (d.kind !== 'file') return NextResponse.json({ error: 'Only files can be shared this way: for a link, share its address' }, { status: 400 });

  const multipart = (req.headers.get('content-type') ?? '').includes('multipart/form-data');
  const form = multipart ? await req.formData() : null;
  const body = form ? Object.fromEntries(['mode', 'days'].map(k => [k, form.get(k)])) : await req.json().catch(() => ({}));
  const mode: ShareMode | null = body.mode === 'public' || body.mode === 'private' ? body.mode : null;
  if (!mode) return NextResponse.json({ error: 'Choose the kind of link' }, { status: 400 });
  if (mode === 'public' && d.protection === 'sealed') {
    return NextResponse.json({ error: 'Sealed documents can only be shared with a private link: new.vote can’t read them to serve them' }, { status: 400 });
  }
  const exp = expiryFor(mode, d.visibility !== 'public', body.days);
  if ('error' in exp) return NextResponse.json({ error: exp.error }, { status: 400 });

  let storedName: string | null = null, size: number | null = null;
  if (mode === 'private') {
    const copy = form?.get('copy');
    if (!(copy instanceof File)) return NextResponse.json({ error: 'The encrypted copy is missing' }, { status: 400 });
    if (copy.size > MODERATOR_LIMIT_BYTES + 1024 * 1024) return NextResponse.json({ error: 'Too large to share' }, { status: 413 });
    const bytes = Buffer.from(await copy.arrayBuffer());
    if (!isShareCopy(bytes)) return NextResponse.json({ error: 'The copy wasn’t encrypted' }, { status: 400 });
    storedName = `share-${crypto.randomUUID()}.sns`;
    const file = storedPath(a.societyId, storedName);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
    size = bytes.length;
  }

  const token = newToken();
  const { rows: [s] } = await pool.query(
    `INSERT INTO document_shares (document_id, customer_id, token_hash, mode, stored_name, size_bytes, expires_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, expires_at`,
    [docId, a.societyId, hashToken(token), mode, storedName, size, exp.expiresAt, a.session!.sub],
  );
  return NextResponse.json({ id: s.id, token, expires_at: s.expires_at }, { status: 201 });
}

export const POST = lockSafe(handlePOST);
