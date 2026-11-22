// Plan limits in practice: warnings at 80% and 100%, storage grace, and held
// (read-only) Societies. Server-only. Runs hourly (instrumentation.ts), and
// only while plan limits are enforced.
//
// Allowances are shared per pool: a person and all the Societies they own
// ('u:<id>'), or a Society with no owner ('s:<id>').

import pool from './db';
import { sendMemberNotice } from './postmark';
import { BASE_URL } from './stripe';
import { PLANS, enforcementOn, entitlementsFor, formatBytes, nextPlan, personPlan, poolUsage } from './plans';

export const STORAGE_GRACE_DAYS = 14;
export const STORAGE_GRACE_CEILING = 1.25;   // during grace, up to 125% of the plan's storage

/** Who hears about a pool: the owner, and their Societies' contact addresses (an ownerless Society: its admins). */
async function recipients(poolKey: string): Promise<string[]> {
  const { rows } = poolKey.startsWith('u:')
    ? await pool.query(
      `SELECT lower(email) AS email FROM users WHERE id::text = $1 AND email IS NOT NULL AND email <> '' AND user_status IS DISTINCT FROM 'closed'
       UNION SELECT lower(contact_email) FROM customers WHERE owner_id::text = $1 AND status = 'active' AND contact_email IS NOT NULL AND contact_email <> ''`,
      [poolKey.slice(2)])
    : await pool.query(
      `SELECT lower(u.email) AS email FROM customer_roles r JOIN users u ON u.id::text = r.user_id::text
       WHERE r.tenant_id = $1 AND r.role = 'customer_admin' AND u.email IS NOT NULL AND u.email <> '' AND u.user_status IS DISTINCT FROM 'closed'
       UNION SELECT lower(contact_email) FROM customers WHERE id = $1 AND contact_email IS NOT NULL AND contact_email <> ''`,
      [Number(poolKey.slice(2))]);
  return rows.map(r => r.email as string);
}
async function tell(poolKey: string, subject: string, text: string) {
  for (const to of await recipients(poolKey)) await sendMemberNotice({ to, subject, text });
}

// ── Storage grace ────────────────────────────────────────────────────────────

/**
 * May this upload go ahead? Over the plan's storage, a pool has 14 days' grace
 * (up to 125% of it) from when it first went over; then uploads stop until
 * it's back under, or on a bigger plan.
 */
export async function storageAllows(poolKey: string, limit: number, after: number): Promise<{ ok: true; grace?: string } | { ok: false; error: string }> {
  if (after <= limit) return { ok: true };
  const { rows: [o] } = await pool.query(
    `INSERT INTO plan_storage_over (pool) VALUES ($1) ON CONFLICT (pool) DO UPDATE SET since = plan_storage_over.since RETURNING since`, [poolKey]);
  const ends = new Date(new Date(o.since).getTime() + STORAGE_GRACE_DAYS * 86400000);
  if (Date.now() > ends.getTime()) {
    return { ok: false, error: `The plan’s ${formatBytes(limit)} of storage is used up, and its ${STORAGE_GRACE_DAYS}-day grace period has ended. Delete files you no longer need, or the owner can move to a bigger plan.` };
  }
  if (after > limit * STORAGE_GRACE_CEILING) {
    return { ok: false, error: `The plan’s ${formatBytes(limit)} of storage is used up. During the grace period it can go up to ${formatBytes(limit * STORAGE_GRACE_CEILING)}; this file would take it past that.` };
  }
  return { ok: true, grace: ends.toISOString() };
}

// ── Warnings ─────────────────────────────────────────────────────────────────

export type Warning = { measure: 'storage' | 'ai'; level: 80 | 100; text: string };

/** The warnings that apply to a Society's pool now (for the page, and the hourly emails). */
export async function warningsFor(societyId: number): Promise<Warning[]> {
  const e = await entitlementsFor(societyId);
  return poolWarnings(e.pool, PLANS[e.plan].limits);
}

async function poolWarnings(poolKey: string, l: (typeof PLANS)['free']['limits']): Promise<Warning[]> {
  const [u, { rows: [over] }] = await Promise.all([poolUsage(poolKey), pool.query('SELECT since FROM plan_storage_over WHERE pool = $1', [poolKey])]);
  const across = u.societies.length > 1 ? ` across ${u.societies.length} Societies` : '';
  const out: Warning[] = [];
  const s = u.storage / l.storageBytes;
  if (s >= 0.8) {
    const graceEnds = over ? new Date(new Date(over.since).getTime() + STORAGE_GRACE_DAYS * 86400000) : null;
    out.push({ measure: 'storage', level: s >= 1 ? 100 : 80,
      text: s >= 1
        ? `Storage is full: ${formatBytes(u.storage)} of ${formatBytes(l.storageBytes)}${across}. ${graceEnds && graceEnds.getTime() > Date.now()
          ? `Uploads carry on until ${graceEnds.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })} (up to ${formatBytes(l.storageBytes * STORAGE_GRACE_CEILING)}), then stop until it’s back under.`
          : graceEnds ? 'New uploads are paused until it’s back under.' : `Uploads get ${STORAGE_GRACE_DAYS} days’ grace (up to ${formatBytes(l.storageBytes * STORAGE_GRACE_CEILING)}), then stop until it’s back under.`}`
        : `Storage is ${Math.floor(s * 100)}% used: ${formatBytes(u.storage)} of ${formatBytes(l.storageBytes)}${across}.` });
  }
  const a = l.aiUsdMonth ? u.ai / l.aiUsdMonth : 0;
  if (a >= 0.8) {
    out.push({ measure: 'ai', level: a >= 1 ? 100 : 80,
      text: a >= 1
        ? `This month’s AI allowance is used up${across}: AI features work without AI until the 1st.`
        : `This month’s AI allowance is ${Math.floor(a * 100)}% used${across}.` });
  }
  return out;
}

/** Every pool with an active Society: owners, and Societies with no owner. */
async function pools(): Promise<{ key: string; plan: keyof typeof PLANS; sysAdmin: boolean }[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT CASE WHEN c.owner_id IS NULL THEN 's:' || c.id ELSE 'u:' || c.owner_id END AS key, COALESCE(u.is_sys_admin, false) AS sys
     FROM customers c LEFT JOIN users u ON u.id = c.owner_id WHERE c.status = 'active'`);
  return Promise.all(rows.map(async r => ({ key: r.key as string, sysAdmin: r.sys, plan: r.key.startsWith('u:') ? (await personPlan(r.key.slice(2))).plan : 'free' as const })));
}

async function sendWarnings() {
  const month = new Date().toISOString().slice(0, 7);
  for (const p of await pools()) {
    const w = await poolWarnings(p.key, PLANS[p.plan].limits);
    // Back under 80%: forget earlier storage warnings (and the grace clock, once under 100%)
    if (!w.some(x => x.measure === 'storage')) await pool.query(`DELETE FROM plan_limit_alerts WHERE pool = $1 AND measure = 'storage'`, [p.key]);
    if (!w.some(x => x.measure === 'storage' && x.level === 100)) await pool.query('DELETE FROM plan_storage_over WHERE pool = $1', [p.key]);
    for (const x of w) {
      const { rowCount } = await pool.query(
        `INSERT INTO plan_limit_alerts (pool, measure, level, period) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [p.key, x.measure, x.level, x.measure === 'ai' ? month : 'storage']);
      if (!rowCount) continue;
      const up = nextPlan(p.plan);
      await tell(p.key, `new.vote: ${x.measure === 'ai' ? 'AI allowance' : 'storage'} ${x.level === 100 ? 'used up' : `${x.level}% used`} on your ${PLANS[p.plan].name} plan`,
        `${x.text}\n\n${up ? `${PLANS[up].name} gives you more: ${BASE_URL}/pricing\n` : ''}Your plan and usage: ${BASE_URL}/dashboard/billing`);
    }
  }
}

// ── Held Societies ───────────────────────────────────────────────────────────

/** An owner's active Societies: active ones first (biggest first), then held ones. */
async function societiesOf(ownerId: string) {
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.held_at IS NOT NULL AS held, (SELECT count(*) FROM customer_members m WHERE m.customer_id = c.id)::int AS members
     FROM customers c WHERE c.owner_id::text = $1 AND c.status = 'active' ORDER BY c.id`, [ownerId]);
  return rows as { id: number; name: string; held: boolean; members: number }[];
}

/**
 * Each owner may run as many Societies as their plan allows. Over it, the
 * smallest extra ones are held; with room again (a bigger plan, or one closed),
 * held ones come back, biggest first.
 */
async function reconcileHolds() {
  for (const p of await pools()) {
    if (!p.key.startsWith('u:') || p.sysAdmin) continue;
    const owner = p.key.slice(2), cap = PLANS[p.plan].limits.societies;
    const all = await societiesOf(owner);
    const active = all.filter(s => !s.held).sort((a, b) => b.members - a.members);
    const held = all.filter(s => s.held).sort((a, b) => b.members - a.members);
    for (const s of active.slice(cap)) {
      await pool.query('UPDATE customers SET held_at = now() WHERE id = $1 AND held_at IS NULL', [s.id]);
      await tell(p.key, `${s.name} is now read-only`,
        `Your ${PLANS[p.plan].name} plan covers ${cap} Societies, and you run ${all.length}. ${s.name} is now read-only: it stays readable and its members can export everything, but nothing new can be added.\n\n` +
        `To use it again, move to a bigger plan, close one of your other Societies, or swap it with another: ${BASE_URL}/dashboard/billing`);
    }
    for (const s of held.slice(0, Math.max(0, cap - active.length))) {
      await pool.query('UPDATE customers SET held_at = NULL WHERE id = $1', [s.id]);
    }
  }
}

async function releaseAll() {
  await pool.query('UPDATE customers SET held_at = NULL WHERE held_at IS NOT NULL');
}

/**
 * The owner makes a held Society active: straight away if their plan has room,
 * or in place of another of their Societies (`instead`), which is held.
 */
export async function activate(societyId: number, by: string, instead?: number): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { rows: [c] } = await pool.query('SELECT owner_id::text AS owner, held_at FROM customers WHERE id = $1', [societyId]);
  if (!c) return { ok: false, status: 404, error: 'Not found' };
  if (c.owner !== by) return { ok: false, status: 403, error: 'Only the Society’s owner can choose which of their Societies are active' };
  if (!c.held_at) return { ok: true };
  const cap = PLANS[(await personPlan(by)).plan].limits.societies;
  const active = (await societiesOf(by)).filter(s => !s.held);
  if (active.length < cap) {
    await pool.query('UPDATE customers SET held_at = NULL WHERE id = $1', [societyId]);
    return { ok: true };
  }
  if (!instead || !active.some(s => s.id === instead)) {
    return { ok: false, status: 409, error: `Your plan covers ${cap} Societies and they’re all in use. Choose one to make read-only instead, or move to a bigger plan.` };
  }
  await pool.query('UPDATE customers SET held_at = CASE WHEN id = $1 THEN NULL ELSE now() END WHERE id IN ($1, $2)', [societyId, instead]);
  return { ok: true };
}

/** The hourly pass. */
export async function planLimitsPass() {
  if (!(await enforcementOn())) { await releaseAll(); return; }
  await reconcileHolds();
  await sendWarnings();
}
