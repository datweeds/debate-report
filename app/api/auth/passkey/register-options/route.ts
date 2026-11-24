import { NextRequest, NextResponse } from 'next/server';
import { isAgeBand, UNDER_16 } from '@/lib/ageBands';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import pool from '@/lib/db';
import { signChallengeToken, challengeCookie } from '@/lib/auth';

const RP_NAME = process.env.WEBAUTHN_RP_NAME || 'new.vote';
const RP_ID   = process.env.WEBAUTHN_RP_ID   || 'new.vote';

export async function POST(req: NextRequest) {
  const { userHandle, email, tier, plan, displayName, bio, inviteToken, agreed, ageBand } = await req.json();

  // A neutral age gate (Online Safety Act): under 16 can't join, and can't simply
  // try again straight away with another answer (a day's block in this browser)
  const GATE = 'nv_age_gate';
  if (ageBand === UNDER_16 || req.cookies.get(GATE)) {
    const res = NextResponse.json({ error: 'Sorry, you can’t create an account on new.vote.', gate: true }, { status: 403 });
    res.cookies.set({ name: GATE, value: '1', maxAge: 24 * 3600, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
    return res;
  }
  // Everyone gives an age group and agrees to the Terms (Online Safety Act, UK GDPR)
  if (!isAgeBand(ageBand)) {
    return NextResponse.json({ error: 'Please tell us your age group' }, { status: 400 });
  }
  if (agreed !== true) {
    return NextResponse.json({ error: 'Please agree to the Terms to continue' }, { status: 400 });
  }

  if (!userHandle?.trim() || userHandle.trim().length < 3) {
    return NextResponse.json({ error: 'Username must be at least 3 characters' }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(userHandle)) {
    return NextResponse.json({ error: 'Username may only contain letters, numbers, _ and -' }, { status: 400 });
  }

  // Check handle and email not already taken
  const existing = await pool.query(
    `SELECT id FROM users WHERE user_handle = $1 OR (email IS NOT NULL AND email = $2)`,
    [userHandle.trim(), email?.trim() || null]
  );
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: 'Username or email already taken' }, { status: 409 });
  }

  // Future user ID — committed to DB only after passkey verification
  const userId = crypto.randomUUID();

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID:   RP_ID,
    userName:        userHandle.trim(),
    userDisplayName: userHandle.trim(),
    userID: new TextEncoder().encode(userId),
    attestationType: 'none',
    authenticatorSelection: {
      residentKey:    'preferred',
      userVerification: 'preferred',
      authenticatorAttachment: 'platform',
    },
    // Ask the passkey to support PRF, so it can also unlock secure access (Sealed items)
    extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
  });

  const token = await signChallengeToken({
    challenge:   options.challenge,
    userId,
    userHandle:  userHandle.trim(),
    email:       email?.trim() || undefined,
    tier:        tier || 'debater',
    plan:        plan || 'free',
    displayName: displayName?.trim() || undefined,
    bio:         bio?.trim() || undefined,
    inviteToken: inviteToken || undefined,
    ageBand,
  });

  const res = NextResponse.json(options);
  res.cookies.set(challengeCookie(token));
  return res;
}
