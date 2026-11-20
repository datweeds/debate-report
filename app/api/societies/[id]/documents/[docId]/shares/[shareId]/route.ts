import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { expiryFor, revokeShares } from '@/lib/documentShares';

type Params = { params: Promise<{ id: string; docId: string; shareId: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

async function load(req: NextRequest, p: Params['params']) {
  const { id, docId, shareId } = await p;
  const a = await societyContentAccess(req, id);
  if (!a?.canModerate || !UUID.test(docId) || !UUID.test(shareId)) return null;
  const { rows: [s] } = await pool.query(
    `SELECT s.id, s.mode, c.visibility FROM document_shares s JOIN customers c ON c.id = s.customer_id
      WHERE s.id = $1 AND s.document_id = $2 AND s.customer_id = $3 AND s.revoked_at IS NULL`,
    [shareId, docId, a.societyId],
  );
  return s ? { a, s } : null;
}

// PATCH { days } — extend (or shorten) a link: it then expires `days` from now (moderators).
export async function PATCH(req: NextRequest, { params }: Params) {
  const m = await load(req, params);
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const exp = expiryFor(m.s.mode, m.s.visibility !== 'public', (await req.json().catch(() => ({}))).days);
  if ('error' in exp) return NextResponse.json({ error: exp.error }, { status: 400 });
  const { rows: [s] } = await pool.query(
    'UPDATE document_shares SET expires_at = $1, extended_at = now() WHERE id = $2 RETURNING expires_at',
    [exp.expiresAt, m.s.id],
  );
  return NextResponse.json({ expires_at: s.expires_at });
}

// DELETE — revoke a link; a private link's encrypted copy is deleted (moderators).
export async function DELETE(req: NextRequest, { params }: Params) {
  const m = await load(req, params);
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await revokeShares(m.a.societyId, { id: m.s.id });
  return NextResponse.json({ ok: true });
}
