import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canSetDebateVisibility } from '@/lib/roles';

type Params = { params: Promise<{ id: string }> };

// Society Admin/SysAdmin for this debate's Society review pending apply
// requests. (The debate's own creator is intentionally excluded here, same
// scope as canSetDebateVisibility — reviewing access requests is a Society
// admin action, not a debate-ownership one.)
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
    `SELECT jr.id, jr.user_id, jr.message, jr.status, jr.created_at,
            u.user_handle, u.user_full_name
     FROM debate_join_requests jr
     LEFT JOIN users u ON u.id::text = jr.user_id
     WHERE jr.resolution_id = $1
     ORDER BY jr.created_at DESC`,
    [id]
  );
  return NextResponse.json(rows);
}
