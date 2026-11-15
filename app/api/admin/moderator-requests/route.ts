import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

// SysAdmin: Moderator requests (pending first, then the 30 most recent decisions).
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { rows } = await pool.query(
    `(SELECT mr.id, mr.status, mr.message, mr.created_at, mr.decided_at, u.user_handle, u.user_full_name, u.user_tier
      FROM moderator_requests mr JOIN users u ON u.id = mr.user_id
      WHERE mr.status = 'pending' ORDER BY mr.created_at)
     UNION ALL
     (SELECT mr.id, mr.status, mr.message, mr.created_at, mr.decided_at, u.user_handle, u.user_full_name, u.user_tier
      FROM moderator_requests mr JOIN users u ON u.id = mr.user_id
      WHERE mr.status <> 'pending' ORDER BY mr.decided_at DESC LIMIT 30)`,
  );
  return NextResponse.json({ requests: rows });
}

// PATCH { id, action: 'approve' | 'reject' } — approving makes the user a Moderator.
export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id, action } = await req.json().catch(() => ({}));
  if (!['approve', 'reject'].includes(action) || typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'id and action are required' }, { status: 400 });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [r] } = await client.query(
      `UPDATE moderator_requests SET status = $2, decided_by = $3, decided_at = now()
       WHERE id = $1 AND status = 'pending' RETURNING user_id`,
      [id, action === 'approve' ? 'approved' : 'rejected', session.sub],
    );
    if (!r) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Request not found' }, { status: 404 }); }
    if (action === 'approve') await client.query(`UPDATE users SET user_tier = 'moderator' WHERE id = $1`, [r.user_id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return NextResponse.json({ ok: true });
}
