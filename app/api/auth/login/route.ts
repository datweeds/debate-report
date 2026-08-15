import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyPassword, verifyAccessCode, createToken, sessionCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { identifier, password, accessCode } = await req.json();

  if (!identifier?.trim()) {
    return NextResponse.json({ error: 'Username or email required' }, { status: 400 });
  }
  if (!password && !accessCode) {
    return NextResponse.json({ error: 'Password or access code required' }, { status: 400 });
  }

  const result = await pool.query(
    `SELECT id, user_handle, password_hash, access_code, is_sys_admin, is_scotparl_mod, user_tier, user_plan, user_status
     FROM users
     WHERE user_handle = $1 OR (email IS NOT NULL AND email = $1)`,
    [identifier.trim()]
  );

  const user = result.rows[0];
  const GENERIC_ERR = { error: 'Invalid credentials' };

  if (!user) return NextResponse.json(GENERIC_ERR, { status: 401 });
  if (user.user_status !== 'active') {
    return NextResponse.json({ error: 'Account suspended' }, { status: 403 });
  }

  let ok = false;
  if (accessCode && user.access_code) {
    ok = await verifyAccessCode(accessCode, user.access_code);
  } else if (password && user.password_hash) {
    ok = await verifyPassword(password, user.password_hash);
  }

  if (!ok) return NextResponse.json(GENERIC_ERR, { status: 401 });

  const [{ rows: roleRows }, { rows: toRows }] = await Promise.all([
    pool.query(`SELECT DISTINCT tenant_id FROM customer_roles WHERE user_id = $1 AND role = 'customer_admin'`, [user.id]),
    pool.query(`SELECT DISTINCT tenant_id FROM topic_owners WHERE user_id = $1`, [user.id]),
  ]);

  const token = await createToken({
    sub: user.id,
    handle: user.user_handle,
    isSysAdmin: user.is_sys_admin,
    isScotparlMod: user.is_scotparl_mod ?? false,
    tier: user.user_tier,
    plan: user.user_plan ?? 'free',
    customerAdminTenants: roleRows.map(r => r.tenant_id as number),
    topicOwnerTenants:    toRows.map(r => r.tenant_id as number),
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie(token));
  return res;
}
