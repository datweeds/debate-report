import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions, type AuthenticatorTransportFuture } from '@simplewebauthn/server';
import pool from '@/lib/db';
import { getSessionFromRequest, signChallengeToken, challengeCookie } from '@/lib/auth';

const RP_ID = process.env.WEBAUTHN_RP_ID || 'new.vote';

// Step 1 of a new recovery code: how this account must confirm it's really them.
// With passkeys → a passkey challenge; otherwise the password or current recovery code.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const { rows: [user] } = await pool.query(
    'SELECT id, password_hash IS NOT NULL AS has_password, access_code IS NOT NULL AS has_code FROM users WHERE id = $1',
    [session.sub]
  );
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { rows: pks } = await pool.query(
    'SELECT credential_id, transports FROM passkeys WHERE user_id = $1',
    [user.id]
  );
  if (pks.length === 0) {
    return NextResponse.json({ method: user.has_password ? 'password' : 'code' });
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: pks.map(r => ({
      id:         r.credential_id,
      transports: (r.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
    })),
    userVerification: 'required',
  });

  const token = await signChallengeToken({ challenge: options.challenge, userId: user.id, purpose: 'recovery' });
  const res = NextResponse.json({ method: 'passkey', options });
  res.cookies.set(challengeCookie(token));
  return res;
}
