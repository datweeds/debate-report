import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { setSetting } from '@/lib/siteSettings';
import { checkSpendAlerts, invalidateSpend, spendSummary } from '@/lib/ai/spend';

// GET — the platform's AI spend today and this month (by day), and both caps.
// SysAdmin. Also runs the 95% alert check.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const s = await spendSummary(true);
  void checkSpendAlerts().catch(err => console.error('[ai] spend alert', err));
  return NextResponse.json(s, { headers: { 'Cache-Control': 'no-store' } });
}

// PUT { monthly_cap_usd } — set the monthly cap (null or '' = no monthly cap)
export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  let cap: number | null = null;
  if (b.monthly_cap_usd !== null && b.monthly_cap_usd !== '' && b.monthly_cap_usd !== undefined) {
    cap = Number(b.monthly_cap_usd);
    if (!(cap >= 0 && cap <= 100000)) return NextResponse.json({ error: 'The monthly cap must be between $0 and $100,000' }, { status: 400 });
  }
  await setSetting('ai_monthly_cap_usd', cap, session.sub);
  invalidateSpend();
  return NextResponse.json({ ok: true, monthly_cap_usd: cap });
}
