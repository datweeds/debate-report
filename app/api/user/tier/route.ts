import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession, createToken, sessionCookie } from '@/lib/auth';

// Free tiers a user can pick for themselves. Moderator (the paid role) is
// requested and approved by a SysAdmin until billing launches.
const SELF_SERVICE_TIERS = ['follower', 'voter', 'debater'];

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const { tier } = await req.json();
  if (tier === 'moderator') {
    return NextResponse.json({ error: 'Request Moderator access instead' }, { status: 403 });
  }
  if (!SELF_SERVICE_TIERS.includes(tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  await pool.query('UPDATE users SET user_tier = $1 WHERE id = $2', [tier, session.sub]);

  // Re-issue token with updated tier
  const token = await createToken({ ...session, tier, plan: session.plan ?? 'free' });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie(token));
  return res;
}
