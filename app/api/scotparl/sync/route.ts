import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { syncAll, syncSSIs, syncActs } from '@/lib/scotparl/sync';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.isSysAdmin && !session?.isScotparlMod) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));

  const parseYears = (raw: unknown) =>
    raw ? String(raw).split(',').map(Number).filter(y => y > 1998 && y <= new Date().getFullYear() + 1) : undefined;

  if (body.ssi_only) {
    const result = await syncSSIs(parseYears(body.years));
    return NextResponse.json({ results: [result], ok: !result.error });
  }

  if (body.acts_only) {
    const result = await syncActs(parseYears(body.years));
    return NextResponse.json({ results: [result], ok: !result.error });
  }

  const results = await syncAll();
  const failed = results.filter(r => r.error);
  return NextResponse.json({ results, ok: failed.length === 0 });
}
