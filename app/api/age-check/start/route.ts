import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { ageCheckSettings } from '@/lib/ageCheck/settings';
import { providerById } from '@/lib/ageCheck/providers';
import { createWalletRequest } from '@/lib/ageCheck/wallet';
import { PRODUCT_URL } from '@/lib/postmark';

// POST { method: 'wallet' | 'face' } — start a check. Nothing about the member is
// put in what goes to the wallet or the provider: a one-time request only.
const recent = new Map<string, number[]>();
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const now = Date.now(), times = (recent.get(session.sub) ?? []).filter(t => now - t < 3600_000);
  if (times.length >= 10) return NextResponse.json({ error: 'Too many attempts. Please try again in an hour.' }, { status: 429 });
  recent.set(session.sub, [...times, now]);
  const { method } = await req.json().catch(() => ({}));
  const s = await ageCheckSettings();
  if (!s.enabled && !session.isSysAdmin) return NextResponse.json({ error: 'Age checks aren’t switched on' }, { status: 409 });
  await pool.query('DELETE FROM age_check_sessions WHERE user_id = $1 OR expires_at < now()', [session.sub]);
  if (method === 'wallet') {
    if (!s.wallet) return NextResponse.json({ error: 'Wallet checks aren’t available' }, { status: 409 });
    // The answer is bound to the web address the member is on (it must be ours)
    const o = req.headers.get('origin') ?? '';
    const origin = /^https:\/\/([a-z0-9-]+\.)?new\.vote$/.test(o) ? o : PRODUCT_URL;
    const { request, state } = await createWalletRequest(origin);
    const { rows: [row] } = await pool.query(`INSERT INTO age_check_sessions (user_id, method, state) VALUES ($1, 'wallet', $2) RETURNING id`, [session.sub, state]);
    return NextResponse.json({ sessionId: row.id, request });
  }
  if (method === 'face') {
    const p = providerById(s.faceProvider);
    if (!p?.ready() || (p.id === 'test' && !session.isSysAdmin)) return NextResponse.json({ error: 'Face checks aren’t available yet' }, { status: 409 });
    const f = await p.start();
    const { rows: [row] } = await pool.query(`INSERT INTO age_check_sessions (user_id, method, state) VALUES ($1, 'face', $2) RETURNING id`, [session.sub, { provider: p.id, face: f }]);
    return NextResponse.json({ sessionId: row.id, provider: p.id, client: f.client });
  }
  return NextResponse.json({ error: 'Choose a way to check' }, { status: 400 });
}
