import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { topicCounts } from '@/lib/societyBrowse';

// GET — { counts: { politics: 3, … } }: Societies per topic that this visitor may know of
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const res = NextResponse.json({ counts: await topicCounts(session?.sub ?? null) });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
