import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { clientIp } from '@/lib/clientIp';
import { ReportError, submitReport } from '@/lib/reports';
import { lockSafe } from '@/lib/lockSafe';

// POST { reason, note?, text? } — report a discussion reply. Kept for the
// discussion page; reporting itself lives in lib/reports.ts (/api/reports).
// `text`: a sealed message as the reporter saw it, since the server can't read it.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string; postId: string }> }) {
  const { postId } = await params;
  const session = await getSessionFromRequest(req);
  const { reason, note, text } = await req.json().catch(() => ({}));
  try {
    const { route } = await submitReport(
      { kind: 'discussion_post', id: String(postId), reason: String(reason ?? ''), note, shown: typeof text === 'string' ? text : undefined },
      session, clientIp(req.headers));
    return NextResponse.json({ ok: true, route }, { status: 201 });
  } catch (e) {
    if (e instanceof ReportError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[report]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'The report couldn’t be sent. Please try again.' }, { status: 500 });
  }
}

export const POST = lockSafe(handlePOST);
