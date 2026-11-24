import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { isAdult, searchAreas } from '@/lib/areas';

// POST { q } — place suggestions. A POST, so what was typed never appears in a
// web address (and so in no server or network log). Not logged here either.
// Adults only.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!await isAdult(session)) return NextResponse.json({ error: 'Not available' }, { status: 403 });
  const { q } = await req.json().catch(() => ({}));
  const res = NextResponse.json({ areas: typeof q === 'string' ? await searchAreas(q) : [] });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
