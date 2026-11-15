import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { generateInviteToken, hashInviteToken, moderatedSociety } from '@/lib/societies';

type Params = { params: Promise<{ id: string }> };

// POST { label?, expiresInDays? } — a new invite link. The link is returned
// once only; just its hash is stored.
export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await moderatedSociety(req, params);
  if (!ctx) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { label, expiresInDays } = await req.json().catch(() => ({}));
  const days = expiresInDays === null || expiresInDays === '' ? null : Number(expiresInDays ?? 30);
  if (days !== null && (!Number.isFinite(days) || days < 1 || days > 365)) {
    return NextResponse.json({ error: 'Expiry must be 1–365 days, or blank for none' }, { status: 400 });
  }
  const raw = generateInviteToken();
  await pool.query(
    `INSERT INTO society_invites (customer_id, token_hash, label, created_by, expires_at)
     VALUES ($1, $2, $3, $4, CASE WHEN $5::int IS NULL THEN NULL ELSE now() + make_interval(days => $5::int) END)`,
    [ctx.id, hashInviteToken(raw), typeof label === 'string' && label.trim() ? label.trim().slice(0, 120) : null, ctx.session.sub, days],
  );
  return NextResponse.json({ path: `/join/${raw}` }, { status: 201 });
}

// PATCH { inviteId } — revoke a link (already-joined members stay members).
export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await moderatedSociety(req, params);
  if (!ctx) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { inviteId } = await req.json().catch(() => ({}));
  if (typeof inviteId !== 'string' || !/^[0-9a-f-]{36}$/i.test(inviteId)) {
    return NextResponse.json({ error: 'inviteId is required' }, { status: 400 });
  }
  await pool.query(
    `UPDATE society_invites SET revoked_at = COALESCE(revoked_at, now()) WHERE id = $1 AND customer_id = $2`,
    [inviteId, ctx.id],
  );
  return NextResponse.json({ ok: true });
}
