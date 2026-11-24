import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { featuredSocieties } from '@/lib/societyBrowse';
import { isAdult } from '@/lib/areas';

// GET — the home page's Societies: 4 public at random; 4 private (the visitor's own first, then Apply ones at random)
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const res = NextResponse.json(await featuredSocieties(session?.sub ?? null, await isAdult(session)));
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
