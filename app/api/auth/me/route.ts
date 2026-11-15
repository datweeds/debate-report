import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession, createToken, sessionCookie } from '@/lib/auth';

// The session token carries tier and SysAdmin status. When either has changed
// in the database (e.g. a SysAdmin approved a Moderator request), re-issue the
// token so the change applies on the next page load, without logging in again.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json(null);

  const { rows: [u] } = await pool.query(
    'SELECT user_tier, is_sys_admin FROM users WHERE id = $1', [session.sub],
  );
  if (!u) return NextResponse.json(null);
  if (u.user_tier === session.tier && !!u.is_sys_admin === !!session.isSysAdmin) {
    return NextResponse.json(session);
  }
  const updated = { ...session, tier: u.user_tier, isSysAdmin: !!u.is_sys_admin };
  const res = NextResponse.json(updated);
  res.cookies.set(sessionCookie(await createToken(updated)));
  return res;
}
