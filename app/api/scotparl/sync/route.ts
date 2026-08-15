import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { syncAll } from '@/lib/scotparl/sync';

export async function POST() {
  const session = await getSession();
  if (!session?.isSysAdmin && !session?.isScotparlMod) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const results = await syncAll();
  const failed = results.filter(r => r.error);
  return NextResponse.json({ results, ok: failed.length === 0 });
}
