import { NextRequest, NextResponse } from 'next/server';
import pool, { SOCIETY_COOKIE } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

// Switch the visitor's current society. Allowed when the target is public,
// or the visitor is a member of it (private societies), or sysadmin (sees
// everything). Logged-out visitors can only switch to public societies.
export async function POST(req: NextRequest) {
  const { customer_id } = await req.json();
  const id = Number(customer_id);
  if (!id || isNaN(id)) return NextResponse.json({ error: 'customer_id is required' }, { status: 400 });

  const { rows } = await pool.query('SELECT id, is_public FROM customers WHERE id = $1', [id]);
  const society = rows[0];
  if (!society) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!society.is_public) {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'This society is private' }, { status: 403 });
    if (!session.isSysAdmin) {
      const { rows: memberRows } = await pool.query(
        'SELECT 1 FROM customer_members WHERE customer_id = $1 AND user_id = $2',
        [id, session.sub]
      );
      if (!memberRows.length) return NextResponse.json({ error: 'This society is private' }, { status: 403 });
    }
  }

  const res = NextResponse.json({ ok: true, id });
  res.cookies.set(SOCIETY_COOKIE, String(id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });
  return res;
}
