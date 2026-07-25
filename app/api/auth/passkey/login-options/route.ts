import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions, type AuthenticatorTransportFuture } from '@simplewebauthn/server';
import pool from '@/lib/db';
import { signChallengeToken, challengeCookie } from '@/lib/auth';

const RP_ID = process.env.WEBAUTHN_RP_ID || 'debate.report';

export async function POST(req: NextRequest) {
  const { identifier } = await req.json();
  if (!identifier?.trim()) {
    return NextResponse.json({ error: 'Username or email required' }, { status: 400 });
  }

  const userRes = await pool.query(
    `SELECT id, user_handle FROM users
     WHERE user_handle = $1 OR (email IS NOT NULL AND email = $1)
     LIMIT 1`,
    [identifier.trim()]
  );

  // Always return options (even for unknown users) to avoid user enumeration
  const user = userRes.rows[0] ?? null;

  let allowCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] = [];
  if (user) {
    const pkRes = await pool.query(
      `SELECT credential_id, transports FROM passkeys WHERE user_id = $1`,
      [user.id]
    );
    allowCredentials = pkRes.rows.map(r => ({
      id:         r.credential_id,
      transports: (r.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
    }));
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials,
    userVerification: 'preferred',
  });

  const token = await signChallengeToken({
    challenge: options.challenge,
    userId:    user?.id ?? '',
  });

  const res = NextResponse.json(options);
  res.cookies.set(challengeCookie(token));
  return res;
}
