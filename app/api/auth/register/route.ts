import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import {
  hashPassword, hashAccessCode, generateAccessCode,
  createToken, sessionCookie,
} from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { userHandle, email, password, tier, incognito } = await req.json();

  if (!userHandle || userHandle.trim().length < 3) {
    return NextResponse.json({ error: 'Username must be at least 3 characters' }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(userHandle)) {
    return NextResponse.json({ error: 'Username may only contain letters, numbers, _ and -' }, { status: 400 });
  }
  if (!incognito && !password) {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 });
  }
  if (!['family', 'debater', 'moderator'].includes(tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT id FROM users
       WHERE user_handle = $1 OR (email IS NOT NULL AND email = $2)`,
      [userHandle.trim(), email?.trim() || null]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Username or email already taken' }, { status: 409 });
    }

    let passwordHash: string | null = null;
    let accessCodeHash: string | null = null;
    let plainCode: string | null = null;

    if (incognito) {
      plainCode = generateAccessCode();
      accessCodeHash = await hashAccessCode(plainCode);
    } else {
      passwordHash = await hashPassword(password);
    }

    const result = await client.query(
      `INSERT INTO users
         (user_handle, email, password_hash, access_code, user_tier, terms_agreed, date_activated)
       VALUES ($1, $2, $3, $4, $5, true, NOW())
       RETURNING id, user_handle, is_sys_admin, user_tier`,
      [
        userHandle.trim(),
        incognito ? null : (email?.trim() || null),
        passwordHash,
        accessCodeHash,
        tier,
      ]
    );
    const user = result.rows[0];

    const token = await createToken({
      sub: user.id,
      handle: user.user_handle,
      isSysAdmin: user.is_sys_admin,
      tier: user.user_tier,
    });

    const res = NextResponse.json({ ok: true, accessCode: plainCode });
    res.cookies.set(sessionCookie(token));
    return res;
  } finally {
    client.release();
  }
}
