import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { ageCheckSettings } from '@/lib/ageCheck/settings';
import { providerById } from '@/lib/ageCheck/providers';
import { verifyWalletResponse, type WalletState } from '@/lib/ageCheck/wallet';
import { recordCheck } from '@/lib/ageCheck';

// POST { sessionId, response } — finish a check: verify the wallet's answer or the
// provider's signed result, and record only the band, the method and the date.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { sessionId, response } = await req.json().catch(() => ({}));
  if (typeof sessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(sessionId)) return NextResponse.json({ error: 'Start again' }, { status: 400 });
  // One use only
  const { rows: [cs] } = await pool.query(
    'DELETE FROM age_check_sessions WHERE id = $1 AND user_id = $2 AND expires_at > now() RETURNING method, state', [sessionId, session.sub]);
  if (!cs) return NextResponse.json({ error: 'That check has expired. Please start again.' }, { status: 410 });
  try {
    if (cs.method === 'wallet') {
      const r = await verifyWalletResponse(cs.state as WalletState, response);
      const out = await recordCheck(session.sub, { ...r, method: 'wallet' });
      return NextResponse.json({ ok: true, ...out });
    }
    const s = await ageCheckSettings();
    const p = providerById(cs.state.provider);
    if (!p) throw new Error('That provider is no longer available');
    const f = await p.result(cs.state.face, response);
    if (!f.live) return NextResponse.json({ error: 'The check couldn’t confirm a live person. Please try again in good light.' }, { status: 422 });
    // Challenge ages above each threshold allow for estimation error
    if (f.estimatedAge >= s.challenge18) return NextResponse.json({ ok: true, ...await recordCheck(session.sub, { over16: true, over18: true, method: 'face' }) });
    if (f.estimatedAge >= s.challenge16) return NextResponse.json({ ok: true, ...await recordCheck(session.sub, { over16: true, over18: false, method: 'face' }), mayProve18: true });
    return NextResponse.json({ ok: false, fallback: true });
  } catch (err) {
    console.error('[age-check] verify failed:', String((err as Error).message ?? err).slice(0, 300));
    return NextResponse.json({ error: 'We couldn’t verify that. Please try again, or choose another way.' }, { status: 422 });
  }
}
