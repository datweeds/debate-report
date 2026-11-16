import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { keyLog, keyStatus, lock, removeFromServer, reveal, storeOnServer, unlock } from '@/lib/masterKey';
import { forgetAllKeys } from '@/lib/societyCrypto';

// The master key for private Societies. SysAdmin only.
// GET — whether it's unlocked and where it's kept, and the log.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ ...keyStatus(), log: await keyLog() }, { headers: { 'Cache-Control': 'no-store' } });
}

// POST { action: unlock | lock | store | remove | reveal, key? }
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { action, key } = await req.json().catch(() => ({}));
  const uid = session.sub;

  if (action === 'reveal') {
    const k = await reveal(uid);
    return k ? NextResponse.json({ key: k }, { headers: { 'Cache-Control': 'no-store' } })
             : NextResponse.json({ error: 'Unlock first.' }, { status: 400 });
  }
  const r =
    action === 'unlock' ? await unlock(key, uid) :
    action === 'lock'   ? await lock(uid, forgetAllKeys) :
    action === 'store'  ? await storeOnServer(uid) :
    action === 'remove' ? await removeFromServer(key, uid) :
    { ok: false as const, error: 'Unknown action' };
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, ...keyStatus() });
}
