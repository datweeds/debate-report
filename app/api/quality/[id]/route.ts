import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { canReviewQuality, getDebate, getReport, startReport } from '@/lib/quality/report';

type Params = { params: Promise<{ id: string }> };

// GET ?report=<id> — a report (default: the latest) with New/Open/Resolved status and run history.
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  const { id } = await params;
  const debate = await getDebate(id);
  if (!debate || !await canReviewQuality(session, debate)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const reportId = req.nextUrl.searchParams.get('report') ?? undefined;
  const data = await getReport(id, reportId && /^[0-9a-f-]{36}$/i.test(reportId) ? reportId : undefined);
  return NextResponse.json({ debate: { id: debate.id, title: debate.stat_title }, ...data });
}

// POST — run a new report. Returns at once; the client polls GET until it completes.
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  const { id } = await params;
  const debate = await getDebate(id);
  if (!session || !debate || !await canReviewQuality(session, debate)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const reportId = await startReport(debate, session.sub);
  return NextResponse.json({ reportId }, { status: 202 });
}
