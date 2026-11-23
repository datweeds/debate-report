import { NextResponse } from 'next/server';

// Retired: accounts are created only with a passkey at /register (via /api/auth/passkey/register-*),
// which asks for an age group and agreement to the Terms. This old password sign-up skipped both.
export async function POST() {
  return NextResponse.json({ error: 'Sign up at new.vote/register with a passkey.' }, { status: 410 });
}
