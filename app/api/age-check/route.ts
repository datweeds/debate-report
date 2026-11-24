import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { ageCheckSettings } from '@/lib/ageCheck/settings';
import { providerById } from '@/lib/ageCheck/providers';
import { trustedIssuers } from '@/lib/ageCheck/trust';

// GET — whether this member has an age check to do, and the ways they can.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const s = await ageCheckSettings();
  const { rows: [u] } = await pool.query('SELECT age_band, age_source, age_check_method, age_checked_at, age_check_due FROM users WHERE id = $1', [session.sub]);
  const face = providerById(s.faceProvider);
  const faceOk = !!face?.ready() && (face.id !== 'test' || session.isSysAdmin);
  return NextResponse.json({
    enabled: s.enabled,
    due: s.enabled && !!u?.age_check_due,
    reason: u?.age_check_due ?? null,
    band: u?.age_band ?? null,
    checked: u?.age_source === 'checked', method: u?.age_check_method ?? null, checkedAt: u?.age_checked_at ?? null,
    methods: { wallet: s.wallet && trustedIssuers().length > 0, face: faceOk ? { id: face!.id, label: face!.label } : null },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
