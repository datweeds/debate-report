import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canSetDebateVisibility } from '@/lib/roles';

type Params = { params: Promise<{ id: string }> };

// Invites an EXISTING Society member (by handle) to an 'invite'-visibility
// debate — "only visible if a Member receives an invitation." Unlike the old
// Forum invite flow, this never onboards a brand-new user: the invitee logs
// in and accepts/declines from their own Invitations list.
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;
  const { rows: [debate] } = await pool.query(
    `SELECT customer_id FROM statements WHERE id = $1 AND stat_type = 'resolution'`,
    [id]
  );
  if (!debate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (debate.customer_id == null || !(await canSetDebateVisibility(session, debate.customer_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { rows } = await pool.query(
    `SELECT di.id, di.invitee_user_id, di.status, di.message, di.created_at,
            u.user_handle, u.user_full_name
     FROM debate_invitations di
     LEFT JOIN users u ON u.id::text = di.invitee_user_id
     WHERE di.resolution_id = $1
     ORDER BY di.created_at DESC`,
    [id]
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;
  const { handle, message } = await req.json();
  if (!handle?.trim()) return NextResponse.json({ error: 'handle is required' }, { status: 400 });

  const { rows: [debate] } = await pool.query(
    `SELECT customer_id FROM statements WHERE id = $1 AND stat_type = 'resolution'`,
    [id]
  );
  if (!debate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (debate.customer_id == null || !(await canSetDebateVisibility(session, debate.customer_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { rows: [user] } = await pool.query('SELECT id FROM users WHERE user_handle = $1', [handle.trim()]);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { rows: [member] } = await pool.query(
    `SELECT 1 FROM customer_members WHERE customer_id = $1 AND user_id = $2 LIMIT 1`,
    [debate.customer_id, user.id]
  );
  if (!member) {
    return NextResponse.json({ error: 'That user is not a member of this debate’s Society' }, { status: 400 });
  }

  await pool.query(
    `INSERT INTO debate_invitations (resolution_id, created_by, invitee_user_id, message)
     VALUES ($1, $2, $3, $4)`,
    [id, session.sub, user.id, message?.trim() || null]
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}
