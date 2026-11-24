import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest, clearCookie } from '@/lib/auth';
import { ageBandOf, isAgeBand, UNDER_16 } from '@/lib/age';
import { evaluate, holdForReview } from '@/lib/ageSignals';
import { ageCheckSettings } from '@/lib/ageCheck/settings';

// GET — your age band. PATCH { band } — change it, up or down (a correction).
// Every change is recorded and counts towards an age check. Choosing "under 16"
// puts the account on hold for the new.vote team to review.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { rows: [u] } = await pool.query('SELECT age_band, age_source FROM users WHERE id = $1', [session.sub]);
  return NextResponse.json({ band: u?.age_band ?? null, checked: u?.age_source === 'checked' });
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { band } = await req.json().catch(() => ({}));
  const current = await ageBandOf(session.sub);
  if (band === UNDER_16) {
    await pool.query(`INSERT INTO age_band_changes (user_id, from_band, to_band) VALUES ($1, $2, 'under-16')`, [session.sub, current]);
    await holdForReview(session.sub, 'member-says-under-16', null);
    const res = NextResponse.json({ held: true });
    res.cookies.set(clearCookie());
    return res;
  }
  if (!isAgeBand(band)) return NextResponse.json({ error: 'Choose an age group' }, { status: 400 });
  if (band === current) return NextResponse.json({ band });
  const { rows: [u] } = await pool.query('SELECT age_source FROM users WHERE id = $1', [session.sub]);
  // A checked age stands; moving down is always allowed (it only adds protection)
  if (u?.age_source === 'checked' && band === '18+') return NextResponse.json({ band: current });
  // With age checks on, moving up to 18+ waits for a passed check
  if (band === '18+' && current === '16-17' && (await ageCheckSettings()).enabled) {
    await pool.query(`UPDATE users SET age_check_due = 'band-up' WHERE id = $1`, [session.sub]);
    await pool.query('INSERT INTO age_band_changes (user_id, from_band, to_band) VALUES ($1, $2, $3)', [session.sub, current, 'requested-18+']);
    return NextResponse.json({ band: current, checkNeeded: true });
  }
  await pool.query(`UPDATE users SET age_band = $1, age_source = CASE WHEN $1 = '16-17' THEN 'declared' ELSE age_source END, updated_at = now() WHERE id = $2`, [band, session.sub]);
  await pool.query('INSERT INTO age_band_changes (user_id, from_band, to_band) VALUES ($1, $2, $3)', [session.sub, current, band]);
  await evaluate(session.sub, null);
  return NextResponse.json({ band });
}
