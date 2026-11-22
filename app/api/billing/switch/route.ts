import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { billingOwner } from '@/lib/billingAccess';
import { BillingError, switchPlan } from '@/lib/billing';

// POST { lookupKey, societyId? } — switch a live plan to another price (Team ↔
// Network, monthly ↔ yearly). Stripe charges or credits the difference.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const owner = await billingOwner(session, b.societyId);
  if (!owner) return NextResponse.json({ error: 'Only this Society’s admins can manage its billing' }, { status: 403 });
  try {
    await switchPlan(owner, String(b.lookupKey ?? ''));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof BillingError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error('[billing] switch', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'The plan couldn’t be changed. Please try again.' }, { status: 502 });
  }
}
