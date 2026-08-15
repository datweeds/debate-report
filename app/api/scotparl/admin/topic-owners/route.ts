import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { tq } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { isCustomerAdmin } from '@/lib/roles';

const TENANT_ID = parseInt(process.env.TENANT_ID ?? '1', 10);

async function authorise(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return null;
  if (session.isSysAdmin || await isCustomerAdmin(session.sub, TENANT_ID)) return session;
  return null;
}

export async function GET(req: NextRequest) {
  if (!await authorise(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // List all topic owners for this tenant with their assigned topics
  const { rows } = await pool.query(
    `SELECT to_.user_id, u.user_handle AS handle,
            json_agg(json_build_object('id', nt.id, 'name', nt.name) ORDER BY nt.name) AS topics
     FROM topic_owners to_
     JOIN users u ON u.id::text = to_.user_id
     JOIN nsp_topics nt ON nt.id = to_.topic_id
     WHERE to_.tenant_id = $1
     GROUP BY to_.user_id, u.user_handle
     ORDER BY u.user_handle`,
    [TENANT_ID]
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!await authorise(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { handle, topic_id } = await req.json();
  if (!handle?.trim() || !topic_id) {
    return NextResponse.json({ error: 'handle and topic_id are required' }, { status: 400 });
  }

  const { rows: [user] } = await pool.query(
    `SELECT id FROM users WHERE user_handle = $1`, [handle.trim()]
  );
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Verify topic belongs to this tenant
  const { rows: [topic] } = await tq(
    `SELECT id FROM nsp_topics WHERE id = $1`, [topic_id]
  );
  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

  await pool.query(
    `INSERT INTO topic_owners (user_id, topic_id, tenant_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, topic_id) DO NOTHING`,
    [user.id, topic_id, TENANT_ID]
  );

  return NextResponse.json({ ok: true });
}
