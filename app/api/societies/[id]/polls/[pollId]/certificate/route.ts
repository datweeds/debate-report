import { NextRequest, NextResponse } from 'next/server';
import { pollContext } from '@/lib/polls/access';
import { resultsVisible } from '@/lib/polls/server';
import { certificateOf, retimestamp } from '@/lib/polls/formal';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string; pollId: string }> };

// GET — a formal ballot's certified result, for whoever may see its results
// (and its scrutineers). ?file=json: the exact certified document (its SHA-256
// is the digest); ?file=tsr: the authority's RFC 3161 timestamp of that digest.
export async function GET(req: NextRequest, { params }: Params) {
  const { id, pollId } = await params;
  const c = await pollContext(req, id, pollId);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!resultsVisible(c.poll, c.manager) && !c.scrutineer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const cert = await certificateOf(c.poll, true);
  if (!cert) return NextResponse.json({ error: 'This result hasn’t been certified' }, { status: 404 });
  const file = req.nextUrl.searchParams.get('file');
  const name = `ballot-${c.poll.id.slice(0, 8)}-certified`;
  if (file === 'json') {
    return new NextResponse(cert.document, { headers: {
      'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.json"`, 'Cache-Control': 'no-store' } });
  }
  if (file === 'tsr') {
    if (!cert.tsa_response) return NextResponse.json({ error: 'No timestamp yet' }, { status: 404 });
    return new NextResponse(Buffer.from(cert.tsa_response, 'base64'), { headers: {
      'Content-Type': 'application/timestamp-reply', 'Content-Disposition': `attachment; filename="${name}.tsr"`, 'Cache-Control': 'no-store' } });
  }
  const { tsa_response: _r, ...rest } = cert;
  return NextResponse.json({ ...rest, manager: c.manager }, { headers: { 'Cache-Control': 'no-store' } });
}

// POST — moderators: try the timestamp again, if the authority was unreachable when certifying
async function handlePOST(req: NextRequest, { params }: Params) {
  const { id, pollId } = await params;
  const c = await pollContext(req, id, pollId);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!c.manager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return (await retimestamp(c.poll))
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'The timestamp authority couldn’t be reached, or the result is already timestamped' }, { status: 502 });
}

export const POST = lockSafe(handlePOST);
