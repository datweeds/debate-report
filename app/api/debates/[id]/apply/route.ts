import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// Any Society member may request access to an 'apply'-visibility debate —
// approval (by that debate's Society Admin/SysAdmin) is what actually grants
// viewing, via the join-requests review endpoint.
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;
  const { message } = await req.json().catch(() => ({ message: null }));

  const { rows: [debate] } = await pool.query(
    `SELECT customer_id, debate_visibility FROM statements WHERE id = $1 AND stat_type = 'resolution'`,
    [id]
  );
  if (!debate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (debate.debate_visibility !== 'apply') {
    return NextResponse.json({ error: 'This debate is not accepting apply requests' }, { status: 400 });
  }
  if (debate.customer_id == null) {
    return NextResponse.json({ error: 'This debate has no Society' }, { status: 400 });
  }

  const { rows: [member] } = await pool.query(
    `SELECT 1 FROM customer_members WHERE customer_id = $1 AND user_id = $2 LIMIT 1`,
    [debate.customer_id, session.sub]
  );
  if (!member) {
    return NextResponse.json({ error: 'Only members of this debate’s Society may apply' }, { status: 403 });
  }

  await pool.query(
    `INSERT INTO debate_join_requests (resolution_id, user_id, message)
     VALUES ($1, $2, $3)
     ON CONFLICT (resolution_id, user_id) DO UPDATE SET message = EXCLUDED.message, status = 'pending', updated_at = now()`,
    [id, session.sub, message?.trim() || null]
  );

  return NextResponse.json({ ok: true });
}
