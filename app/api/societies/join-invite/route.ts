import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { addMember, lookupInvite } from '@/lib/societies';
import { areaJoinProblem } from '@/lib/ageCheck';

// POST { token } — accept a Society invite link: the logged-in user becomes a member.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Log in to accept this invitation' }, { status: 401 });
  const { token } = await req.json().catch(() => ({}));
  const invite = typeof token === 'string' ? await lookupInvite(token) : null;
  if (!invite) return NextResponse.json({ error: 'This invitation is no longer valid' }, { status: 404 });
  const areaProblem = await areaJoinProblem(session.sub, invite.customer_id);
  if (areaProblem) return NextResponse.json(areaProblem === 'CHECK'
    ? { error: 'This is a local Society: please confirm your age first.', ageCheck: true }
    : { error: areaProblem }, { status: 403 });

  await addMember(invite.customer_id, session.sub);
  await pool.query(
    'UPDATE society_invites SET use_count = use_count + 1, last_used_at = now() WHERE id = $1',
    [invite.id],
  );
  // Any open join request is now moot
  await pool.query(
    `UPDATE society_join_requests SET status = 'approved', decided_at = now()
     WHERE customer_id = $1 AND user_id = $2 AND status = 'pending'`,
    [invite.customer_id, session.sub],
  );
  return NextResponse.json({ ok: true, societyId: invite.customer_id });
}
