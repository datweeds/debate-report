import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { ageBandOf, isAgeBand, mayChangeBand } from '@/lib/age';

// GET — your age band. PATCH { band } — set it, or move up a band (never down).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Sign in' }, { status: 401 });
  return NextResponse.json({ band: await ageBandOf(session.sub) });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Sign in' }, { status: 401 });
  const { band } = await req.json().catch(() => ({}));
  if (!isAgeBand(band)) return NextResponse.json({ error: 'Choose an age group' }, { status: 400 });
  const current = await ageBandOf(session.sub);
  if (!mayChangeBand(current, band)) {
    return NextResponse.json({ error: 'You can move up an age group, but not down. Contact us if it’s wrong.' }, { status: 400 });
  }
  await pool.query('UPDATE users SET age_band = $1, updated_at = NOW() WHERE id::text = $2', [band, session.sub]);
  return NextResponse.json({ band });
}
