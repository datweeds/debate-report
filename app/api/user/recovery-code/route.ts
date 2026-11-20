import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse, type AuthenticatorTransportFuture } from '@simplewebauthn/server';
import pool from '@/lib/db';
import {
  getSessionFromRequest, verifyChallengeToken, clearChallengeCookie, CHALLENGE_COOKIE,
  generateAccessCode, hashAccessCode, verifyPassword, verifyAccessCode,
} from '@/lib/auth';
import { clientAddress, loginBlocked, loginFailed, loginSucceeded } from '@/lib/loginThrottle';

const RP_ID   = process.env.WEBAUTHN_RP_ID   || 'new.vote';
const ORIGINS = (process.env.WEBAUTHN_ORIGIN || 'https://new.vote').split(',').map(s => s.trim());

// Step 2: confirm it's really the account holder, then replace the recovery code.
// The old code stops working; the new one is returned once and only its hash is kept.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const { rows: [user] } = await pool.query(
    'SELECT id, user_handle, password_hash, access_code FROM users WHERE id = $1',
    [session.sub]
  );
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { rows: pks } = await pool.query(
    'SELECT id, credential_id, public_key, counter, transports FROM passkeys WHERE user_id = $1',
    [user.id]
  );

  let ok = false;
  if (pks.length > 0) {
    // Accounts with passkeys must confirm with one (a stolen session alone isn't enough)
    const chalToken = req.cookies.get(CHALLENGE_COOKIE)?.value;
    const chal = chalToken ? await verifyChallengeToken(chalToken) : null;
    if (!chal || chal.purpose !== 'recovery' || chal.userId !== user.id) {
      return NextResponse.json({ error: 'Confirmation expired. Please try again.' }, { status: 400 });
    }
    const pk = pks.find(p => p.credential_id === body.assertion?.id);
    if (!pk) return NextResponse.json({ error: 'That passkey isn\'t on your account' }, { status: 401 });
    try {
      const v = await verifyAuthenticationResponse({
        response:          body.assertion,
        expectedChallenge: chal.challenge,
        expectedOrigin:    ORIGINS,
        expectedRPID:      RP_ID,
        credential: {
          id:         pk.credential_id,
          publicKey:  new Uint8Array(pk.public_key),
          counter:    Number(pk.counter),
          transports: (pk.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
        },
        requireUserVerification: true,
      });
      ok = v.verified;
      if (ok) {
        await pool.query('UPDATE passkeys SET counter = $1, last_used_at = NOW() WHERE id = $2',
          [v.authenticationInfo.newCounter, pk.id]);
      }
    } catch {
      ok = false;
    }
  } else {
    // No passkeys: the password, or the current recovery code (rate-limited like login)
    const address = clientAddress(req.headers);
    const wait = loginBlocked(user.user_handle, address);
    if (wait) return NextResponse.json({ error: `Too many attempts. Please try again in ${wait} minute${wait === 1 ? '' : 's'}.` }, { status: 429 });
    if (typeof body.password === 'string' && body.password && user.password_hash) {
      ok = await verifyPassword(body.password, user.password_hash);
    } else if (typeof body.currentCode === 'string' && body.currentCode && user.access_code) {
      ok = await verifyAccessCode(body.currentCode.trim().toUpperCase(), user.access_code);
    }
    if (ok) loginSucceeded(user.user_handle); else loginFailed(user.user_handle, address);
  }

  if (!ok) {
    const res = NextResponse.json({ error: 'Could not confirm it\'s you' }, { status: 401 });
    res.cookies.set(clearChallengeCookie());
    return res;
  }

  const code = generateAccessCode();
  await pool.query('UPDATE users SET access_code = $1 WHERE id = $2', [await hashAccessCode(code), user.id]);

  const res = NextResponse.json({ code });
  res.headers.set('Cache-Control', 'no-store');
  res.cookies.set(clearChallengeCookie());
  return res;
}
