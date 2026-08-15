import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string; reqId: string }> };

// PATCH — accept or deny a join request (forum owner)
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, reqId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  // Verify ownership
  const { rows: [forum] } = await pool.query(
    `SELECT id FROM debate_forums WHERE id = $1 AND forum_owner = $2 AND forum_status != 'deleted'`,
    [id, session.sub]
  );
  if (!forum) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { rows: [request] } = await pool.query(
    `SELECT jr.id, jr.user_id, jr.join_status
     FROM join_requests jr WHERE jr.id = $1 AND jr.forum_id = $2`,
    [reqId, id]
  );
  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

  const { action } = await req.json(); // 'accept' | 'deny'
  if (!['accept', 'deny'].includes(action)) {
    return NextResponse.json({ error: 'Action must be accept or deny' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE join_requests SET join_status = $1, updated_at = NOW() WHERE id = $2`,
      [action === 'accept' ? 'accepted' : 'rejected', reqId]
    );
    if (action === 'accept') {
      await client.query(
        `INSERT INTO forum_members (forum_id, user_id, member_role, member_status)
         VALUES ($1, $2, 'debater', 'active')
         ON CONFLICT (forum_id, user_id) DO UPDATE SET member_status = 'active', updated_at = NOW()`,
        [id, request.user_id]
      );
    }
    await client.query('COMMIT');
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Join request action error:', err);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  } finally {
    client.release();
  }
}
