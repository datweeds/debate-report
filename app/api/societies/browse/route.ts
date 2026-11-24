import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { browseSocieties } from '@/lib/societyBrowse';
import { TOPIC_KEYS } from '@/lib/societyTopics';
import { isAdult } from '@/lib/areas';

type Opts = { q?: unknown; topic?: unknown; kind?: unknown; offset?: unknown; limit?: unknown; ids?: unknown };

// Societies the visitor may know exist, for the menu search and the Society browser.
//   GET ?q=words&topic=politics&kind=all|public|private&offset=0&limit=20
//   POST { …the same, ids: [3, 7] }: only those Societies (from matching areas on the
//        member's device). A POST, so the list never appears in a web address or a log.
async function run(req: NextRequest, o: Opts) {
  const session = await getSessionFromRequest(req);
  const topic = typeof o.topic === 'string' && TOPIC_KEYS.includes(o.topic) ? o.topic : null;
  const ids = Array.isArray(o.ids) ? o.ids.filter((x): x is number => Number.isInteger(x)).slice(0, 2000) : null;
  const res = NextResponse.json(await browseSocieties(session?.sub ?? null, {
    q: typeof o.q === 'string' ? o.q : '',
    topic,
    kind: o.kind === 'public' || o.kind === 'private' ? o.kind : 'all',
    offset: Number(o.offset) || 0,
    limit: Number(o.limit) || 20,
    ids,
    adult: await isAdult(session),
  }));
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  return run(req, { q: p.get('q'), topic: p.get('topic'), kind: p.get('kind'), offset: p.get('offset'), limit: p.get('limit') });
}
export async function POST(req: NextRequest) {
  return run(req, await req.json().catch(() => ({})));
}
