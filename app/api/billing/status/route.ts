import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { subscriptionsOf } from '@/lib/billing';
import { PLANS, enforcementOn, personPlan, plansOnSale, poolUsage } from '@/lib/plans';
import { warningsFor } from '@/lib/holds';

// The signed-in person's plan (it covers every Society they own, with storage
// and AI shared across them), their Societies, and the Societies they help
// run under someone else's plan.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
  const me = session.sub;
  const [{ rows: [u] }, subs, plan, usage, enforced, onSale, { rows: owned }, { rows: others }] = await Promise.all([
    pool.query('SELECT stripe_customer_id IS NOT NULL AS has, is_sys_admin FROM users WHERE id = $1', [me]),
    subscriptionsOf({ kind: 'user', id: me }),
    personPlan(me),
    poolUsage(`u:${me}`),
    enforcementOn(), plansOnSale(),
    pool.query(
      `SELECT c.id, c.name, c.status, c.held_at IS NOT NULL AS held,
              (SELECT count(*) FROM customer_members m WHERE m.customer_id = c.id)::int AS members,
              COALESCE((SELECT sum(size_bytes) FROM documents d WHERE d.customer_id = c.id AND d.deleted_at IS NULL AND d.kind = 'file'), 0)::bigint AS storage
       FROM customers c WHERE c.owner_id = $1 AND c.status IS DISTINCT FROM 'deleted' ORDER BY c.held_at NULLS FIRST, c.name`, [me]),
    pool.query(
      `SELECT c.id, c.name, o.user_handle AS owner FROM customers c
       JOIN customer_roles r ON r.tenant_id = c.id AND r.user_id::text = $1 AND r.role = 'customer_admin'
       LEFT JOIN users o ON o.id = c.owner_id
       WHERE c.owner_id IS DISTINCT FROM $1::uuid AND c.status IS DISTINCT FROM 'deleted' ORDER BY c.name`, [me]),
  ]);
  const active = owned.filter(s => s.status === 'active');
  return NextResponse.json({
    hasAccount: !!u?.has, subscriptions: subs, enforced, onSale, sysAdmin: !!u?.is_sys_admin,
    plan: { ...plan, name: PLANS[plan.plan].name, limits: PLANS[plan.plan].limits },
    usage: { storage: usage.storage, ai: usage.ai, societies: active.filter(s => !s.held).length },
    warnings: enforced && active[0] ? await warningsFor(active[0].id) : [],
    societies: owned.map(s => ({ id: s.id, name: s.name, held: s.held, closed: s.status === 'closed', members: s.members, storage: Number(s.storage) })),
    others,
    planNames: Object.fromEntries(Object.entries(PLANS).map(([k, p]) => [k, p.name])),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
