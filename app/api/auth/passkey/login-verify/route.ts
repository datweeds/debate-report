import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse, type AuthenticatorTransportFuture } from '@simplewebauthn/server';
import pool from '@/lib/db';
import {
  verifyChallengeToken, clearChallengeCookie,
  sessionCookie, createToken,
  CHALLENGE_COOKIE,
} from '@/lib/auth';

const RP_ID   = process.env.WEBAUTHN_RP_ID   || 'debate.report';
const ORIGINS = (process.env.WEBAUTHN_ORIGIN || 'https://debate.report').split(',').map(s => s.trim());

export async function POST(req: NextRequest) {
  const chalToken = req.cookies.get(CHALLENGE_COOKIE)?.value;
  if (!chalToken) return NextResponse.json({ error: 'Challenge expired' }, { status: 400 });

  const chal = await verifyChallengeToken(chalToken);
  if (!chal || !chal.userId) return NextResponse.json({ error: 'Challenge expired or invalid' }, { status: 400 });

  const body = await req.json();
  const credentialId: string = body.id;

  // Look up the specific passkey — by (userId + credentialId) if we know the user,
  // or by credentialId alone for discoverable-credential flows (unknown identifier)
  const pkRes = chal.userId
    ? await pool.query(
        `SELECT p.id, p.credential_id, p.public_key, p.counter, p.transports,
                u.id AS user_id, u.user_handle, u.is_sys_admin, u.user_tier
         FROM passkeys p
         JOIN users u ON u.id = p.user_id
         WHERE p.user_id = $1 AND p.credential_id = $2`,
        [chal.userId, credentialId]
      )
    : await pool.query(
        `SELECT p.id, p.credential_id, p.public_key, p.counter, p.transports,
                u.id AS user_id, u.user_handle, u.is_sys_admin, u.user_tier
         FROM passkeys p
         JOIN users u ON u.id = p.user_id
         WHERE p.credential_id = $1`,
        [credentialId]
      );

  if (pkRes.rows.length === 0) {
    return NextResponse.json({ error: 'Passkey not recognised' }, { status: 401 });
  }

  const pk = pkRes.rows[0];

  let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
  try {
    verification = await verifyAuthenticationResponse({
      response:          body,
      expectedChallenge: chal.challenge,
      expectedOrigin:    ORIGINS,
      expectedRPID:      RP_ID,
      credential: {
        id:         pk.credential_id,
        publicKey:  new Uint8Array(pk.public_key),
        counter:    Number(pk.counter),
        transports: (pk.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
      },
      requireUserVerification: false,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: 'Passkey verification failed' }, { status: 401 });
  }

  // Update counter and last_used_at
  await pool.query(
    `UPDATE passkeys SET counter = $1, last_used_at = NOW() WHERE id = $2`,
    [verification.authenticationInfo.newCounter, pk.id]
  );

  const token = await createToken({
    sub:        pk.user_id,
    handle:     pk.user_handle,
    isSysAdmin: pk.is_sys_admin ?? false,
    tier:       pk.user_tier,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie(token));
  res.cookies.set(clearChallengeCookie());
  return res;
}
