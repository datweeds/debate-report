import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { startCheckout, BillingError } from '@/lib/billing';
import { billingOwner } from '@/lib/billingAccess';

// Body: { lookupKey, societyId?, returnPath? } → { url } of a Stripe Checkout page
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { lookupKey?: string; societyId?: number; returnPath?: string };
  const owner = await billingOwner(session, body.societyId);
  if (!owner) return NextResponse.json({ error: 'Only this Society’s admins can manage its billing' }, { status: 403 });
  if (typeof body.lookupKey !== 'string') return NextResponse.json({ error: 'Choose a plan' }, { status: 400 });
  try {
    return NextResponse.json({ url: await startCheckout(owner, body.lookupKey, session.sub, body.returnPath ?? '/dashboard/billing') });
  } catch (e) {
    if (e instanceof BillingError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[stripe] checkout', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Checkout couldn’t be started. Please try again.' }, { status: 502 });
  }
}
