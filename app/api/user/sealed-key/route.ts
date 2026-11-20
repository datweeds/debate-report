import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getIdentity, removePasskeyLock, saveIdentity, savePasskeyLock, sealedPasskeys } from '@/lib/sealed/server';

// GET — your secure-access identity as stored (public key, and the private key
// locked in a vault the server can't open), or null if not set up yet; and
// your account's passkeys, with the lock each opens if it unlocks secure access.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const [identity, passkeys] = await Promise.all([getIdentity(session.sub), sealedPasskeys(session.sub)]);
  return NextResponse.json({ identity, passkeys, userId: session.sub });
}

// PUT { publicKey, vault, phraseLock, reset? } — set up secure access, or with
// reset: replace a lost one (keys locked for the old one are dropped; other
// members' browsers then share access again).
export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const b = await req.json().catch(() => null);
  const problem = await saveIdentity(session.sub, b, b?.reset === true);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// POST { credentialId, lock } — let that passkey unlock your secure access
// (the lock is made in your browser with the passkey's secret, which stays there).
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const problem = await savePasskeyLock(session.sub, b.credentialId, b.lock);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// DELETE { credentialId } — that passkey no longer unlocks secure access
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (typeof b.credentialId !== 'string') return NextResponse.json({ error: 'Which passkey?' }, { status: 400 });
  await removePasskeyLock(session.sub, b.credentialId);
  return NextResponse.json({ ok: true });
}
