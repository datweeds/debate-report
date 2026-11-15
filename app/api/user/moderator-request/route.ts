import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET — this user's latest Moderator request (if any).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  const { rows } = await pool.query(
    `SELECT status, created_at, decided_at FROM moderator_requests
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [session.sub],
  );
  return NextResponse.json({ request: rows[0] ?? null });
}

// POST { message? } — ask to become a Moderator.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  if (session.tier === 'moderator') return NextResponse.json({ error: 'You are already a Moderator' }, { status: 409 });
  const { message } = await req.json().catch(() => ({}));
  await pool.query(
    `INSERT INTO moderator_requests (user_id, message) VALUES ($1, $2)
     ON CONFLICT (user_id) WHERE status = 'pending' DO UPDATE SET message = EXCLUDED.message`,
    [session.sub, typeof message === 'string' && message.trim() ? message.trim().slice(0, 1000) : null],
  );
  return NextResponse.json({ ok: true }, { status: 201 });
}
