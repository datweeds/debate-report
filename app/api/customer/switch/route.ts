import { NextRequest, NextResponse } from 'next/server';
import pool, { SOCIETY_COOKIE } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { getSocietyAccess } from '@/lib/societies';

// Switch the visitor's current society. Public and Apply Societies: anyone
// (an Apply Society shows non-members a teaser and a join button). Invite
// Societies: members and moderators only.
export async function POST(req: NextRequest) {
  const { customer_id } = await req.json();
  const id = Number(customer_id);
  if (!id || isNaN(id)) return NextResponse.json({ error: 'customer_id is required' }, { status: 400 });

  const session = await getSessionFromRequest(req);
  const access = await getSocietyAccess(session, id);
  if (!access || !access.canSeeTeaser) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const res = NextResponse.json({ ok: true, id });
  res.cookies.set(SOCIETY_COOKIE, String(id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });
  return res;
}
