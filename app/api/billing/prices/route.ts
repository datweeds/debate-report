import { NextRequest, NextResponse } from 'next/server';
import { catalogue } from '@/lib/billing';
import { getSessionFromRequest } from '@/lib/auth';
import { plansOnSale } from '@/lib/plans';

// Plans on sale (empty until prices are set up in Stripe)
export async function GET(req: NextRequest) {
  try {
    if (!(await plansOnSale()) && !(await getSessionFromRequest(req))?.isSysAdmin) return NextResponse.json({ prices: [] });
    return NextResponse.json({ prices: await catalogue() });
  } catch (e) {
    console.error('[stripe] catalogue', e instanceof Error ? e.message : e);
    return NextResponse.json({ prices: [], error: 'Plans couldn’t be loaded' }, { status: 502 });
  }
}
