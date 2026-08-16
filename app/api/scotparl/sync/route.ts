import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { syncAll, syncSSIs } from '@/lib/scotparl/sync';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.isSysAdmin && !session?.isScotparlMod) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));

  // ?ssi_only=true&years=2024,2025 — sync only SSIs for specified years
  if (body.ssi_only) {
    const years: number[] | undefined = body.years
      ? String(body.years).split(',').map(Number).filter(y => y > 1998 && y <= new Date().getFullYear() + 1)
      : undefined;
    const result = await syncSSIs(years);
    return NextResponse.json({ results: [result], ok: !result.error });
  }

  const results = await syncAll();
  const failed = results.filter(r => r.error);
  return NextResponse.json({ results, ok: failed.length === 0 });
}
