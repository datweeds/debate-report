import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { portalUrl, BillingError } from '@/lib/billing';
import { billingOwner } from '@/lib/billingAccess';

// Body: { societyId?, returnPath? } → { url } of Stripe's billing portal
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { societyId?: number; returnPath?: string };
  const owner = await billingOwner(session, body.societyId);
  if (!owner) return NextResponse.json({ error: 'Only this Society’s admins can manage its billing' }, { status: 403 });
  try {
    return NextResponse.json({ url: await portalUrl(owner, body.returnPath ?? '/dashboard/billing') });
  } catch (e) {
    if (e instanceof BillingError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[stripe] portal', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'The billing portal couldn’t be opened. Please try again.' }, { status: 502 });
  }
}
