import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { clientIp } from '@/lib/clientIp';
import { ReportError, submitReport } from '@/lib/reports';

export const dynamic = 'force-dynamic';

// POST { kind, id, reason, note?, shown?, share?, website? } — report an item.
// Open to people without an account (5 reports a day per address).
// `shown`: the text as the reporter saw it, for sealed content the server can't read.
// `share`: a document share link's token, for reports from a shared document.
// `website`: a field people never see; bots fill it in.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (typeof b.website === 'string' && b.website.trim()) return NextResponse.json({ ok: true, route: 'society' }, { status: 201 });
  const session = await getSessionFromRequest(req);
  try {
    const { route } = await submitReport({
      kind: String(b.kind ?? ''), id: String(b.id ?? ''), reason: String(b.reason ?? ''),
      note: typeof b.note === 'string' ? b.note : undefined,
      shown: typeof b.shown === 'string' ? b.shown.slice(0, 4000) : undefined,
      share: typeof b.share === 'string' ? b.share : undefined,
    }, session, clientIp(req.headers));
    return NextResponse.json({ ok: true, route }, { status: 201 });
  } catch (e) {
    if (e instanceof ReportError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[report]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'The report couldn’t be sent. Please try again.' }, { status: 500 });
  }
}
