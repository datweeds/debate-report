import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

const IMPACTS = ['outage', 'degraded', 'maintenance', 'security'];
const STATES = ['scheduled', 'investigating', 'identified', 'monitoring', 'resolved'];

// POST { title, body, impact, state, startsAt? } — post an incident or planned maintenance (Sys Admin)
// PATCH { id, body?, state } — update it; state 'resolved' closes it
export async function POST(req: NextRequest) {
  const s = await getSessionFromRequest(req);
  if (!s?.isSysAdmin) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { title, body, impact, state, startsAt } = await req.json().catch(() => ({}));
  if (typeof title !== 'string' || title.trim().length < 3) return NextResponse.json({ error: 'Give it a title' }, { status: 400 });
  if (!IMPACTS.includes(impact) || !STATES.includes(state)) return NextResponse.json({ error: 'Choose the impact and state' }, { status: 400 });
  const start = typeof startsAt === 'string' && !isNaN(Date.parse(startsAt)) ? new Date(startsAt) : new Date();
  const { rows: [r] } = await pool.query(
    `INSERT INTO status_incidents (title, body, impact, state, started_at, resolved_at, created_by)
     VALUES ($1, $2, $3, $4, $5, CASE WHEN $4 = 'resolved' THEN now() END, $6) RETURNING id`,
    [title.trim().slice(0, 200), typeof body === 'string' ? body.trim().slice(0, 4000) : '', impact, state, start, s.sub]);
  return NextResponse.json({ id: r.id }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const s = await getSessionFromRequest(req);
  if (!s?.isSysAdmin) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { id, body, state } = await req.json().catch(() => ({}));
  if (!Number.isInteger(id) || !STATES.includes(state)) return NextResponse.json({ error: 'That wasn’t understood' }, { status: 400 });
  const { rowCount } = await pool.query(
    `UPDATE status_incidents SET state = $2, body = COALESCE($3, body), updated_at = now(),
            resolved_at = CASE WHEN $2 = 'resolved' THEN COALESCE(resolved_at, now()) ELSE NULL END WHERE id = $1`,
    [id, state, typeof body === 'string' ? body.trim().slice(0, 4000) : null]);
  return rowCount ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
}
