import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions, type AuthenticatorTransportFuture } from '@simplewebauthn/server';
import pool from '@/lib/db';
import { getSessionFromRequest, signChallengeToken, challengeCookie } from '@/lib/auth';

const RP_NAME = process.env.WEBAUTHN_RP_NAME || 'new.vote';
const RP_ID   = process.env.WEBAUTHN_RP_ID   || 'new.vote';

// Logged-in user adds another passkey to their own account (e.g. a new device).
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const { rows: [user] } = await pool.query(
    'SELECT id, user_handle FROM users WHERE id = $1',
    [session.sub]
  );
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const pkRes = await pool.query(
    'SELECT credential_id, transports FROM passkeys WHERE user_id = $1',
    [user.id]
  );

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID:   RP_ID,
    userName:        user.user_handle,
    userDisplayName: user.user_handle,
    // Same user ID encoding as sign-up, so login-verify maps the new passkey to this account
    userID: new TextEncoder().encode(user.id),
    attestationType: 'none',
    // Stops the same authenticator being registered twice
    excludeCredentials: pkRes.rows.map(r => ({
      id:         r.credential_id,
      transports: (r.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
    })),
    // No authenticatorAttachment: allow this device, a phone (QR) or a security key
    authenticatorSelection: {
      residentKey:      'preferred',
      userVerification: 'preferred',
    },
    // Ask the passkey to support PRF, so it can also unlock secure access (Sealed items)
    extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
  });

  const token = await signChallengeToken({
    challenge: options.challenge,
    userId:    user.id,
    purpose:   'add',
  });

  const res = NextResponse.json(options);
  res.cookies.set(challengeCookie(token));
  return res;
}
