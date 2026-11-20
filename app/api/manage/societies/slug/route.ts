import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { slugAvailable, slugProblem, suggestSlug } from '@/lib/societyRef';

// GET ?value=<name>&except=<Society id>, or ?suggest=<Society name> — is this web-address name usable?
export async function GET(req: NextRequest) {
  if (!await getSessionFromRequest(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const q = req.nextUrl.searchParams;
  const suggestFrom = q.get('suggest');
  if (suggestFrom) {
    const base = suggestSlug(suggestFrom);
    let slug = base;
    for (let n = 2; !slugProblem(slug) && !(await slugAvailable(slug)) && n < 100; n++) slug = `${base.slice(0, 36)}-${n}`;
    return NextResponse.json({ slug });
  }
  const value = (q.get('value') ?? '').trim().toLowerCase();
  const problem = slugProblem(value);
  if (problem) return NextResponse.json({ ok: false, error: problem });
  const except = Number(q.get('except')) || undefined;
  if (!(await slugAvailable(value, except))) return NextResponse.json({ ok: false, error: 'That address is already taken' });
  return NextResponse.json({ ok: true });
}
