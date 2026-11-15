import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canSetDebateVisibility } from '@/lib/roles';

type Params = { params: Promise<{ id: string; reqId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id, reqId } = await params;
  const { action } = await req.json();
  if (action !== 'accept' && action !== 'deny') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const { rows: [debate] } = await pool.query(
    `SELECT customer_id FROM statements WHERE id = $1 AND stat_type = 'resolution'`,
    [id]
  );
  if (!debate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (debate.customer_id == null || !(await canSetDebateVisibility(session, debate.customer_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { rows: [reqRow] } = await pool.query(
    `UPDATE debate_join_requests SET status = $1, updated_at = now()
     WHERE id = $2 AND resolution_id = $3 AND status = 'pending'
     RETURNING user_id`,
    [action === 'accept' ? 'accepted' : 'denied', reqId, id]
  );
  if (!reqRow) return NextResponse.json({ error: 'Request not found or already resolved' }, { status: 404 });

  if (action === 'accept') {
    await pool.query(
      `INSERT INTO debate_members (resolution_id, user_id, member_status)
       VALUES ($1, $2, 'active')
       ON CONFLICT (resolution_id, user_id) DO UPDATE SET member_status = 'active', updated_at = now()`,
      [id, reqRow.user_id]
    );
  }

  return NextResponse.json({ ok: true });
}
