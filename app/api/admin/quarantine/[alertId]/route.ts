import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { discardQuarantined, markReported, openQuarantined } from '@/lib/quarantine';
import { isLockedError } from '@/lib/masterKey';

type Params = { params: Promise<{ alertId: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

// GET — a quarantined image, for the Sys Admin only. Never cached.
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { alertId } = await params;
  if (!UUID.test(alertId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const img = await openQuarantined(alertId, session.sub);
    if (!img) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return new NextResponse(new Uint8Array(img.bytes), { headers: {
      'Content-Type': img.mime, 'Cache-Control': 'no-store, private', 'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'",
    } });
  } catch (err) {
    if (isLockedError(err)) return NextResponse.json({ error: 'The master key isn’t loaded' }, { status: 423 });
    throw err;
  }
}

// PATCH { action: 'discard' } — delete now; { action: 'reported', reference } — reported to the NCA: keep a year
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { alertId } = await params;
  if (!UUID.test(alertId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { action, reference } = await req.json().catch(() => ({}));
  if (action === 'discard') return NextResponse.json({ ok: await discardQuarantined(alertId) });
  if (action === 'reported') {
    if (typeof reference !== 'string' || !reference.trim()) return NextResponse.json({ error: 'Give the NCA reference' }, { status: 400 });
    return NextResponse.json({ ok: await markReported(alertId, reference.trim()) });
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
