import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { addMember, getSocietyAccess } from '@/lib/societies';

type Params = { params: Promise<{ id: string }> };

// POST { message? } — join a public Society (straight away), or ask to join
// an Apply Society (a moderator approves it).
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Log in to request to join' }, { status: 401 });
  const id = Number((await params).id);
  const access = Number.isInteger(id) ? await getSocietyAccess(session, id) : null;
  if (!access || access.visibility === 'invite') return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (access.isMember || access.isModerator) return NextResponse.json({ error: 'You are already a member' }, { status: 409 });
  if (access.visibility === 'public') {
    await addMember(id, session.sub);
    return NextResponse.json({ ok: true, joined: true }, { status: 201 });
  }

  const { message } = await req.json().catch(() => ({}));
  await pool.query(
    `INSERT INTO society_join_requests (customer_id, user_id, message)
     VALUES ($1, $2, $3)
     ON CONFLICT (customer_id, user_id) WHERE status = 'pending' DO NOTHING`,
    [id, session.sub, typeof message === 'string' && message.trim() ? message.trim().slice(0, 1000) : null],
  );
  return NextResponse.json({ ok: true }, { status: 201 });
}
