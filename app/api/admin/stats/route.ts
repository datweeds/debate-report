import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { buildAnalytics } from '@/lib/analytics';

// Site analytics for Sys Admin (lib/analytics.ts): the whole site.
export async function GET() {
  // Middleware already verified sysadmin
  try {
    const session = await getSession();
    return NextResponse.json(await buildAnalytics({ scope: null, me: session?.sub ?? null, sysAdmin: true }));
  } catch (err) {
    console.error('Admin stats error:', err);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}
