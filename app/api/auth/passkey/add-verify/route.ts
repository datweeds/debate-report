import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import pool from '@/lib/db';
import {
  getSessionFromRequest, verifyChallengeToken, clearChallengeCookie, CHALLENGE_COOKIE,
} from '@/lib/auth';

const RP_ID   = process.env.WEBAUTHN_RP_ID   || 'new.vote';
const ORIGINS = (process.env.WEBAUTHN_ORIGIN || 'https://new.vote').split(',').map(s => s.trim());

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const chalToken = req.cookies.get(CHALLENGE_COOKIE)?.value;
  if (!chalToken) return NextResponse.json({ error: 'Challenge expired' }, { status: 400 });

  const chal = await verifyChallengeToken(chalToken);
  // The challenge must have been issued to this same user for adding a passkey
  if (!chal || chal.purpose !== 'add' || chal.userId !== session.sub) {
    return NextResponse.json({ error: 'Challenge expired or invalid' }, { status: 400 });
  }

  const body = await req.json();

  let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
  try {
    verification = await verifyRegistrationResponse({
      response:          body,
      expectedChallenge: chal.challenge,
      expectedOrigin:    ORIGINS,
      expectedRPID:      RP_ID,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'Passkey verification failed' }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const transports: string[] = credential.transports ?? body.response?.transports ?? [];

  try {
    await pool.query(
      `INSERT INTO passkeys
         (user_id, credential_id, public_key, counter, device_type, backed_up, transports)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        session.sub,
        credential.id,
        Buffer.from(credential.publicKey),
        credential.counter,
        credentialDeviceType ?? null,
        credentialBackedUp ?? false,
        transports,
      ]
    );
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'This passkey is already registered' }, { status: 409 });
    }
    console.error('passkey add-verify error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(clearChallengeCookie());
  return res;
}
