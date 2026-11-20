import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { PUSH_KINDS, publicKey } from '@/lib/push';

// GET — what the notification settings need: the site's push key, the kinds of
// notice, your Societies, what you've switched off, and how many devices are on.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const [{ rows: [prefs] }, { rows: societies }, { rows: [devices] }] = await Promise.all([
    pool.query('SELECT muted_kinds, muted_societies FROM push_prefs WHERE user_id = $1', [session.sub]),
    pool.query(
      `SELECT c.id, c.name FROM customers c WHERE c.id IN (
         SELECT customer_id FROM customer_members WHERE user_id::text = $1
         UNION SELECT tenant_id FROM customer_roles WHERE user_id::text = $1 AND role = 'customer_admin') ORDER BY c.name`, [session.sub]),
    pool.query('SELECT count(*)::int AS n FROM push_subscriptions WHERE user_id = $1', [session.sub]),
  ]);
  return NextResponse.json({
    publicKey: publicKey(), kinds: PUSH_KINDS, societies,
    mutedKinds: prefs?.muted_kinds ?? [], mutedSocieties: prefs?.muted_societies ?? [], devices: devices.n,
  });
}

// POST { endpoint, keys: { p256dh, auth } } — switch notifications on for this device.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const ok = typeof b.endpoint === 'string' && /^https:\/\//.test(b.endpoint) && b.endpoint.length < 1000
    && typeof b.keys?.p256dh === 'string' && b.keys.p256dh.length < 200 && typeof b.keys?.auth === 'string' && b.keys.auth.length < 100;
  if (!ok) return NextResponse.json({ error: 'That subscription wasn’t understood' }, { status: 400 });
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, p256dh = $3, auth = $4, user_agent = $5`,
    [session.sub, b.endpoint, b.keys.p256dh, b.keys.auth, (req.headers.get('user-agent') ?? '').slice(0, 300)]);
  return NextResponse.json({ ok: true });
}

// DELETE { endpoint } — switch notifications off for this device.
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { endpoint } = await req.json().catch(() => ({}));
  if (typeof endpoint === 'string') await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2', [session.sub, endpoint]);
  return NextResponse.json({ ok: true });
}

// PUT { mutedKinds, mutedSocieties } — what not to be notified about.
export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const known = new Set<string>(PUSH_KINDS.map(k => k.id));
  const kinds = Array.isArray(b.mutedKinds) ? b.mutedKinds.filter((k: unknown): k is string => typeof k === 'string' && known.has(k)) : [];
  const socs = Array.isArray(b.mutedSocieties) ? b.mutedSocieties.filter((n: unknown): n is number => Number.isInteger(n)).slice(0, 500) : [];
  await pool.query(
    `INSERT INTO push_prefs (user_id, muted_kinds, muted_societies) VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET muted_kinds = $2, muted_societies = $3, updated_at = now()`,
    [session.sub, kinds, socs]);
  return NextResponse.json({ ok: true });
}
