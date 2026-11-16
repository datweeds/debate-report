import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { NewsError, newsFetch } from '@/lib/news';

// GET ?q= — places matching a name, for a Society's News locations
export async function GET(req: NextRequest) {
  if (!await getSessionFromRequest(req)) return NextResponse.json({ error: 'Sign in' }, { status: 401 });
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 2) return NextResponse.json({ places: [] });
  try {
    return NextResponse.json({ places: await newsFetch(`/v1/locations/resolve?q=${encodeURIComponent(q.slice(0, 100))}`) });
  } catch (err) {
    if (err instanceof NewsError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
