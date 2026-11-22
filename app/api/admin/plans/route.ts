import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { setSetting } from '@/lib/siteSettings';
import { PLANS, enforcementOn, isPlanKey, personPlan, plansOnSale, poolUsage } from '@/lib/plans';

async function sysAdmin(req: NextRequest) {
  const s = await getSessionFromRequest(req);
  return s?.isSysAdmin ? s : null;
}

// GET — plan settings; everyone who owns a Society, with their plan and shared
// usage; Societies with no owner; and the grants. SysAdmin.
export async function GET(req: NextRequest) {
  if (!(await sysAdmin(req))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const [enforced, onSale, { rows: owners }, { rows: ownerless }, { rows: grants }] = await Promise.all([
    enforcementOn(), plansOnSale(),
    pool.query(`SELECT u.id, u.user_handle AS handle,
                       count(*) FILTER (WHERE c.status = 'active' AND c.held_at IS NULL)::int AS active,
                       count(*) FILTER (WHERE c.held_at IS NOT NULL)::int AS held, string_agg(c.name, ', ' ORDER BY c.name) AS names
                FROM customers c JOIN users u ON u.id = c.owner_id WHERE c.status IS DISTINCT FROM 'deleted'
                GROUP BY u.id, u.user_handle ORDER BY u.user_handle`),
    pool.query(`SELECT id, name FROM customers WHERE owner_id IS NULL AND status IS DISTINCT FROM 'deleted' ORDER BY name`),
    pool.query(`SELECT g.id, g.plan, g.until, g.reason, g.created_at, u.user_handle AS person, b.user_handle AS granted_by
                FROM plan_grants g JOIN users u ON u.id = g.user_id LEFT JOIN users b ON b.id = g.granted_by
                WHERE g.revoked_at IS NULL AND (g.until IS NULL OR g.until > now()) ORDER BY g.created_at DESC`),
  ]);
  const people = await Promise.all(owners.map(async o => {
    const [p, u] = await Promise.all([personPlan(o.id), poolUsage(`u:${o.id}`)]);
    const l = PLANS[p.plan].limits;
    return { ...o, plan: p.plan, planName: PLANS[p.plan].name, source: p.source, until: p.until, societiesLimit: l.societies,
      storage: u.storage, storageLimit: l.storageBytes, ai: u.ai, aiLimit: l.aiUsdMonth };
  }));
  return NextResponse.json({
    enforced, onSale, plans: Object.entries(PLANS).map(([key, p]) => ({ key, name: p.name })),
    people, ownerless, grants,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

// PUT { enforced?, onSale?, runNow? } — the plan switches, or run the hourly checks now
export async function PUT(req: NextRequest) {
  const s = await sysAdmin(req);
  if (!s) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (typeof b.enforced === 'boolean') await setSetting('plan_enforcement', b.enforced, s.sub);
  if (typeof b.onSale === 'boolean') await setSetting('plans_on_sale', b.onSale, s.sub);
  if (b.runNow === true) { const { planLimitsPass } = await import('@/lib/holds'); await planLimitsPass(); }
  return NextResponse.json({ ok: true });
}

// POST { handle, plan, until?, reason } — give a person a plan without a subscription
export async function POST(req: NextRequest) {
  const s = await sysAdmin(req);
  if (!s) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!isPlanKey(b.plan) || b.plan === 'free') return NextResponse.json({ error: 'Choose a paid plan' }, { status: 400 });
  const reason = typeof b.reason === 'string' ? b.reason.trim().slice(0, 300) : '';
  if (!reason) return NextResponse.json({ error: 'Give a reason (e.g. charity, lifetime, comped while testing)' }, { status: 400 });
  const handle = typeof b.handle === 'string' ? b.handle.trim().replace(/^@/, '') : '';
  const { rows: [u] } = await pool.query('SELECT id FROM users WHERE lower(user_handle) = lower($1)', [handle]);
  if (!u) return NextResponse.json({ error: 'No account has that username' }, { status: 404 });
  let until: Date | null = null;
  if (b.until) {
    until = new Date(b.until);
    if (isNaN(until.getTime()) || until <= new Date()) return NextResponse.json({ error: 'The end date must be in the future' }, { status: 400 });
  }
  await pool.query('INSERT INTO plan_grants (user_id, plan, until, reason, granted_by) VALUES ($1, $2, $3, $4, $5)', [u.id, b.plan, until, reason, s.sub]);
  return NextResponse.json({ ok: true }, { status: 201 });
}

// DELETE ?id= — end a grant
export async function DELETE(req: NextRequest) {
  if (!(await sysAdmin(req))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { rowCount } = await pool.query('UPDATE plan_grants SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [id]);
  return rowCount ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
}
