import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { moderatedSociety } from '@/lib/societies';
import { openText } from '@/lib/societyCrypto';
import { raiseAgeConcern } from '@/lib/ageSignals';

type Params = { params: Promise<{ id: string }> };

// GET — age concerns raised in this Society: when, about whom, by whom (a Society
// Admin, a member or a visitor: never their name, unless it was you), why, and the
// outcome. Never the automatic age signals, which only the new.vote team sees.
export async function GET(req: NextRequest, { params }: Params) {
  const ctx = await moderatedSociety(req, params);
  if (!ctx) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { rows } = await pool.query(
    `SELECT a.id, a.created_at, a.decided_at, a.status, a.raised_as, a.note, a.item_kind, a.raised_by::text = $2 AS mine,
            u.user_handle, u.user_status = 'closed' AS gone
     FROM age_concerns a JOIN users u ON u.id = a.user_id
     WHERE a.customer_id = $1 ORDER BY a.created_at DESC LIMIT 200`, [ctx.id, ctx.session.sub]);
  for (const r of rows) {
    r.note = r.note ? await openText(ctx.id, r.note).catch(() => null) : null;
    if (r.gone) r.user_handle = null;   // a closed account keeps no name
  }
  return NextResponse.json({ concerns: rows });
}

// POST { userId, note } — a Society Admin raises an age concern about a member.
export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await moderatedSociety(req, params);
  if (!ctx) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { userId, note } = await req.json().catch(() => ({}));
  if (typeof userId !== 'string' || !/^[0-9a-f-]{36}$/i.test(userId) || userId === ctx.session.sub) return NextResponse.json({ error: 'Choose a member' }, { status: 400 });
  const { rows: [m] } = await pool.query('SELECT 1 FROM customer_members WHERE customer_id = $1 AND user_id = $2', [ctx.id, userId]);
  if (!m) return NextResponse.json({ error: 'They aren’t a member of this Society' }, { status: 404 });
  const { rows: [open] } = await pool.query(`SELECT 1 FROM age_concerns WHERE user_id = $1 AND customer_id = $2 AND status = 'pending'`, [userId, ctx.id]);
  if (open) return NextResponse.json({ error: 'There’s already an open concern about this member' }, { status: 409 });
  const text = typeof note === 'string' ? note.trim().slice(0, 1000) : '';
  if (text.length < 3) return NextResponse.json({ error: 'Say why you’re concerned' }, { status: 400 });
  await raiseAgeConcern({ userId, societyId: ctx.id, raisedBy: ctx.session.sub, raisedAs: 'society_admin', note: text, itemKind: null });
  return NextResponse.json({ ok: true }, { status: 201 });
}
