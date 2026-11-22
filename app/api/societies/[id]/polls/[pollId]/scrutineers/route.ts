import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { pollContext } from '@/lib/polls/access';
import { certificateOf, scrutineers } from '@/lib/polls/formal';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string; pollId: string }> };

// GET — a formal ballot's scrutineers. Moderators and scrutineers.
export async function GET(req: NextRequest, { params }: Params) {
  const { id, pollId } = await params;
  const c = await pollContext(req, id, pollId);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!c.manager && !c.scrutineer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ scrutineers: await scrutineers(c.poll.id) });
}

// POST { handle } — moderators appoint a member as scrutineer (until the result is certified)
async function handlePOST(req: NextRequest, { params }: Params) {
  const { id, pollId } = await params;
  const c = await pollContext(req, id, pollId);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!c.manager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!c.poll.formal) return NextResponse.json({ error: 'Scrutineers are for formal ballots' }, { status: 400 });
  if (await certificateOf(c.poll)) return NextResponse.json({ error: 'The result is already certified' }, { status: 409 });
  const { handle } = await req.json().catch(() => ({}));
  const h = typeof handle === 'string' ? handle.trim().replace(/^@/, '') : '';
  const { rows: [u] } = await pool.query(
    `SELECT u.id FROM users u WHERE lower(u.user_handle) = lower($1)
       AND u.id::text IN (SELECT user_id::text FROM customer_members WHERE customer_id = $2
                          UNION SELECT user_id::text FROM customer_roles WHERE tenant_id = $2 AND role = 'customer_admin')`, [h, c.a.societyId]);
  if (!u) return NextResponse.json({ error: 'No member of this Society has that username' }, { status: 404 });
  await pool.query('INSERT INTO poll_scrutineers (poll_id, user_id, added_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [c.poll.id, u.id, c.a.session!.sub]);
  return NextResponse.json({ scrutineers: await scrutineers(c.poll.id) }, { status: 201 });
}

// DELETE { userId } — moderators remove a scrutineer (until the result is certified)
async function handleDELETE(req: NextRequest, { params }: Params) {
  const { id, pollId } = await params;
  const c = await pollContext(req, id, pollId);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!c.manager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (await certificateOf(c.poll)) return NextResponse.json({ error: 'The result is already certified' }, { status: 409 });
  const { userId } = await req.json().catch(() => ({}));
  await pool.query('DELETE FROM poll_scrutineers WHERE poll_id = $1 AND user_id::text = $2', [c.poll.id, String(userId)]);
  return NextResponse.json({ scrutineers: await scrutineers(c.poll.id) });
}

export const POST = lockSafe(handlePOST);
export const DELETE = lockSafe(handleDELETE);
