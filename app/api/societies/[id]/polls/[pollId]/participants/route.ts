import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { pollContext } from '@/lib/polls/access';
import { openRows } from '@/lib/societyCrypto';

type Params = { params: Promise<{ id: string; pollId: string }> };

// GET — moderators: turnout. Who has voted (not how), and which members haven't yet.
export async function GET(req: NextRequest, { params }: Params) {
  const { id, pollId } = await params;
  const c = await pollContext(req, id, pollId);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!c.manager && !c.scrutineer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const [{ rows: voted }, { rows: notYet }] = await Promise.all([
    pool.query(
      `SELECT p.voted_at, u.user_handle AS handle, u.user_full_name AS name, k.label AS code_label
       FROM poll_participants p LEFT JOIN users u ON u.id = p.user_id LEFT JOIN poll_codes k ON k.id = p.code_id
       WHERE p.poll_id = $1 ORDER BY p.voted_at DESC`, [c.poll.id]),
    pool.query(
      `SELECT u.user_handle AS handle, u.user_full_name AS name FROM users u
       WHERE u.id::text IN (SELECT user_id FROM customer_members WHERE customer_id = $1
                            UNION SELECT user_id FROM customer_roles WHERE tenant_id = $1 AND role = 'customer_admin')
         AND NOT EXISTS (SELECT 1 FROM poll_participants p WHERE p.poll_id = $2 AND p.user_id = u.id)
       ORDER BY u.user_handle`, [c.a.societyId, c.poll.id]),
  ]);
  await openRows(c.a.societyId, voted, ['code_label']);
  return NextResponse.json({ voted, notYet: c.poll.members_may_vote ? notYet : [] });
}
