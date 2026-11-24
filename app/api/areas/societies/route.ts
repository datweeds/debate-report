import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { isAdult, societyAreaIndex } from '@/lib/areas';

// GET — the Societies that have an Area (id, area path, level), for matching
// against the member's own area in their browser: we never learn theirs.
// Adults only: anyone else gets { adult: false } (and their browser forgets any area).
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !await isAdult(session)) return NextResponse.json({ adult: false, societies: [] }, { headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json({ adult: true, societies: await societyAreaIndex(session.sub) }, { headers: { 'Cache-Control': 'no-store' } });
}
