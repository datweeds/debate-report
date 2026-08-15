import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// GET — list join requests for a forum (owner only)
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { rows: [forum] } = await pool.query(
    `SELECT id FROM debate_forums WHERE id = $1 AND forum_owner = $2 AND forum_status != 'deleted'`,
    [id, session.sub]
  );
  if (!forum) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { rows } = await pool.query(
    `SELECT jr.id, jr.join_status, jr.join_message, jr.created_at, jr.updated_at,
            u.id AS user_id, u.user_handle, u.user_full_name
     FROM   join_requests jr
     JOIN   users u ON u.id = jr.user_id
     WHERE  jr.forum_id = $1
     ORDER  BY jr.created_at DESC`,
    [id]
  );
  return NextResponse.json(rows);
}

// POST — submit a join request (logged-in user)
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  // Verify forum exists and is apply-type
  const { rows: [forum] } = await pool.query(
    `SELECT id, forum_visibility FROM debate_forums
     WHERE id = $1 AND forum_status = 'active' AND forum_visibility = 'apply'`,
    [id]
  );
  if (!forum) return NextResponse.json({ error: 'Forum not found or not open for applications' }, { status: 404 });

  // Check not already a member
  const { rows: [member] } = await pool.query(
    `SELECT 1 FROM forum_members WHERE forum_id = $1 AND user_id = $2 AND member_status = 'active'`,
    [id, session.sub]
  );
  if (member) return NextResponse.json({ error: 'You are already a member of this forum' }, { status: 409 });

  const { message } = await req.json().catch(() => ({ message: null }));

  // Upsert (user may have previously had a denied request and is reapplying)
  const { rows: [request] } = await pool.query(
    `INSERT INTO join_requests (forum_id, user_id, join_message, join_status)
     VALUES ($1, $2, $3, 'pending')
     ON CONFLICT (forum_id, user_id)
     DO UPDATE SET join_message = EXCLUDED.join_message, join_status = 'pending', updated_at = NOW()
     RETURNING id, join_status`,
    [id, session.sub, message?.trim() || null]
  );
  return NextResponse.json(request, { status: 201 });
}
