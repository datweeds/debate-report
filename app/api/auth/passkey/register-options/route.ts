import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import pool from '@/lib/db';
import { signChallengeToken, challengeCookie } from '@/lib/auth';

const RP_NAME = process.env.WEBAUTHN_RP_NAME || 'debate.report';
const RP_ID   = process.env.WEBAUTHN_RP_ID   || 'debate.report';

export async function POST(req: NextRequest) {
  const { userHandle, email, tier } = await req.json();

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
  });

  const token = await signChallengeToken({
    challenge:  options.challenge,
    userId,
    userHandle: userHandle.trim(),
    email:      email?.trim() || undefined,
    tier:       tier || 'follower',
  });

  const res = NextResponse.json(options);
  res.cookies.set(challengeCookie(token));
  return res;
}
