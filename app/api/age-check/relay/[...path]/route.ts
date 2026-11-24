import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { ageCheckSettings } from '@/lib/ageCheck/settings';
import { providerById } from '@/lib/ageCheck/providers';

type Params = { params: Promise<{ path: string[] }> };
const MAX = 32 * 1024;   // integrity data is small; a face image is far bigger and is refused

// The face-check provider's SDK calls only this address (the page's Content
// Security Policy allows no other), and we forward to the provider without
// cookies or anything about the member. Each call's path and size is logged.
async function relay(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const p = providerById((await ageCheckSettings()).faceProvider);
  if (!p?.relayBase) return NextResponse.json({ error: 'Not available' }, { status: 404 });
  const body = req.method === 'GET' ? undefined : new Uint8Array(await req.arrayBuffer());
  const path = (await params).path.map(encodeURIComponent).join('/');
  console.log(`[age-relay] ${p.id} ${req.method} /${path} ${body?.length ?? 0} bytes`);
  if (body && body.length > MAX) {
    console.error(`[age-relay] BLOCKED oversized payload to ${p.id}: ${body.length} bytes`);
    return NextResponse.json({ error: 'Too large' }, { status: 413 });
  }
  const r = await fetch(`${p.relayBase}/${path}${req.nextUrl.search}`, {
    method: req.method, body, signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': req.headers.get('content-type') ?? 'application/json' },
  });
  return new NextResponse(await r.arrayBuffer(), { status: r.status, headers: { 'Content-Type': r.headers.get('content-type') ?? 'application/json', 'Cache-Control': 'no-store' } });
}
export { relay as GET, relay as POST, relay as PUT };
