// Plans: what a person's Societies may use. Server-only.
//
// A plan belongs to a person. Each Society has an owner (customers.owner_id:
// its creator, unless handed on) and uses the owner's plan; storage and AI
// are shared across all the Societies that person owns. Members never pay.
// A Society with no owner (the site's own) stands alone on Pod.
//
// A person's plan, best first: a live Stripe subscription (product metadata
// plan=society|society_plus, for=user), a plan grant from a Sys Admin, a paid
// plan that ended less than 30 days ago, otherwise Pod (free).
//
// Limits are only enforced once a Sys Admin turns on "Enforce plan limits"
// (Admin → Plans). Until then usage is measured and shown, nothing is blocked.
// Self-hosted copies leave it off, so everything is unlimited.

import { NextResponse } from 'next/server';
import pool from './db';
import { getSetting } from './siteSettings';
import { LIVE_STATUSES } from './billing';

export type PlanKey = 'free' | 'society' | 'society_plus';

export type Limits = {
  societies: number;             // Societies the person can run (more are held read-only)
  storageBytes: number;          // documents and files, shared across their Societies
  aiUsdMonth: number;            // platform AI per calendar month, shared (own AI key: unlimited, costs us nothing)
  maxFileBytes: number;          // largest single upload
  aiStandard: boolean;           // Debate Quality Reports and the AI argue helper (the costlier tasks)
  meetMinutes: number | null;    // per call; null = unlimited
  meetParticipants: number;      // per call
  votingCodes: boolean;          // poll access codes for people without an account
  recurringEvents: boolean;
  formalBallots: boolean;
  support: string;
};

const MB = 1024 ** 2, GB = 1024 ** 3;

export const PLANS: Record<PlanKey, { name: string; month: number; year: number; limits: Limits }> = {
  free: {
    name: 'Pod', month: 0, year: 0,
    limits: { societies: 3, storageBytes: 500 * MB, aiUsdMonth: 0.5, maxFileBytes: 25 * MB, aiStandard: false, meetMinutes: 30, meetParticipants: 10,
      votingCodes: false, recurringEvents: false, formalBallots: false, support: 'Help pages' },
  },
  society: {
    name: 'Team', month: 4, year: 40,
    limits: { societies: 10, storageBytes: 5 * GB, aiUsdMonth: 1, maxFileBytes: 50 * MB, aiStandard: true, meetMinutes: 90, meetParticipants: 25,
      votingCodes: true, recurringEvents: true, formalBallots: false, support: 'Email, best effort' },
  },
  society_plus: {
    name: 'Network', month: 9, year: 90,
    limits: { societies: 25, storageBytes: 15 * GB, aiUsdMonth: 3, maxFileBytes: 90 * MB, aiStandard: true, meetMinutes: null, meetParticipants: 50,
      votingCodes: true, recurringEvents: true, formalBallots: true, support: 'Email reply within 2 working days' },
  },
};
const RANK: Record<PlanKey, number> = { free: 0, society: 1, society_plus: 2 };
export const isPlanKey = (p: unknown): p is PlanKey => typeof p === 'string' && p in PLANS;
export const nextPlan = (p: PlanKey): PlanKey | null => (p === 'free' ? 'society' : p === 'society' ? 'society_plus' : null);

export const enforcementOn = () => getSetting<boolean>('plan_enforcement', false);
export const plansOnSale = () => getSetting<boolean>('plans_on_sale', false);

export type PersonPlan = { plan: PlanKey; source: 'free' | 'subscription' | 'grant' | 'grace'; until: string | null };
export type Entitlements = PersonPlan & {
  name: string; limits: Limits; enforced: boolean;
  ownerId: string | null; ownerHandle: string | null;
  pool: string;                  // whose allowances are shared: 'u:<owner id>' or 's:<society id>'
};

/** A person's plan. */
export async function personPlan(userId: string): Promise<PersonPlan> {
  const [{ rows: grants }, { rows: subs }, { rows: ended }] = await Promise.all([
    pool.query(`SELECT plan, until FROM plan_grants WHERE user_id = $1 AND revoked_at IS NULL AND (until IS NULL OR until > now())`, [userId]),
    pool.query(`SELECT plan, current_period_end AS until FROM billing_subscriptions
                WHERE user_id = $1 AND status = ANY($2) AND plan IN ('society', 'society_plus')`, [userId, LIVE_STATUSES]),
    // A plan that ended (cancelled, or unpaid) keeps working for 30 days
    pool.query(`SELECT plan, GREATEST(COALESCE(canceled_at, current_period_end), current_period_end) + interval '30 days' AS until
                FROM billing_subscriptions
                WHERE user_id = $1 AND NOT (status = ANY($2)) AND plan IN ('society', 'society_plus')
                  AND GREATEST(COALESCE(canceled_at, current_period_end), current_period_end) + interval '30 days' > now()`, [userId, LIVE_STATUSES]),
  ]);
  let best: PersonPlan = { plan: 'free', source: 'free', until: null };
  for (const [rows, source] of [[subs, 'subscription'], [grants, 'grant'], [ended, 'grace']] as const) {
    for (const r of rows) {
      const plan: unknown = r.plan;
      if (isPlanKey(plan) && RANK[plan] > RANK[best.plan]) best = { plan, source, until: r.until ? new Date(r.until).toISOString() : null };
    }
  }
  return best;
}

/** The Society's owner, if it has one. */
export async function ownerOf(societyId: number): Promise<{ id: string; handle: string; isSysAdmin: boolean } | null> {
  const { rows: [r] } = await pool.query(
    `SELECT u.id, u.user_handle AS handle, u.is_sys_admin FROM customers c JOIN users u ON u.id = c.owner_id WHERE c.id = $1`, [societyId]);
  return r ? { id: r.id, handle: r.handle, isSysAdmin: !!r.is_sys_admin } : null;
}

/** The Society's plan: its owner's. */
export async function planOf(societyId: number): Promise<PersonPlan> {
  const o = await ownerOf(societyId);
  return o ? personPlan(o.id) : { plan: 'free', source: 'free', until: null };
}

export async function entitlementsFor(societyId: number): Promise<Entitlements> {
  const o = await ownerOf(societyId);
  const [p, enforced] = await Promise.all([o ? personPlan(o.id) : Promise.resolve<PersonPlan>({ plan: 'free', source: 'free', until: null }), enforcementOn()]);
  return { ...p, name: PLANS[p.plan].name, limits: PLANS[p.plan].limits, enforced,
    ownerId: o?.id ?? null, ownerHandle: o?.handle ?? null, pool: o ? `u:${o.id}` : `s:${societyId}` };
}

// ── Usage (shared across the owner's Societies) ──────────────────────────────

/** The Societies sharing a pool's allowances (any not deleted, held ones included). */
export async function poolSocieties(poolKey: string): Promise<number[]> {
  if (poolKey.startsWith('s:')) return [Number(poolKey.slice(2))];
  const { rows } = await pool.query(`SELECT id FROM customers WHERE owner_id::text = $1 AND status IS DISTINCT FROM 'deleted'`, [poolKey.slice(2)]);
  return rows.map(r => r.id as number);
}
const poolKeyOf = async (societyId: number) => { const o = await ownerOf(societyId); return o ? `u:${o.id}` : `s:${societyId}`; };

async function storageOf(ids: number[]): Promise<number> {
  if (!ids.length) return 0;
  const { rows: [r] } = await pool.query(
    `SELECT COALESCE((SELECT sum(size_bytes) FROM documents WHERE customer_id = ANY($1) AND deleted_at IS NULL AND kind = 'file'), 0)
          + COALESCE((SELECT sum(size_bytes) FROM document_shares WHERE customer_id = ANY($1) AND stored_name IS NOT NULL AND revoked_at IS NULL), 0) AS n`,
    [ids]);
  return Number(r.n);
}
async function aiOf(ids: number[]): Promise<number> {
  if (!ids.length) return 0;
  const { rows: [r] } = await pool.query(
    `SELECT COALESCE(sum(cost_usd), 0)::float AS n FROM ai_calls
     WHERE customer_id = ANY($1) AND scope = 'platform' AND created_at >= date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`, [ids]);
  return r.n;
}

/** Storage used by the Society's pool: all its owner's Societies together. */
export async function storageUsed(societyId: number): Promise<number> { return storageOf(await poolSocieties(await poolKeyOf(societyId))); }
/** Platform AI this calendar month (UTC), US$, across the owner's Societies. Own AI keys don't count. */
export async function aiUsedThisMonth(societyId: number): Promise<number> { return aiOf(await poolSocieties(await poolKeyOf(societyId))); }
export async function poolUsage(poolKey: string): Promise<{ storage: number; ai: number; societies: number[] }> {
  const ids = await poolSocieties(poolKey);
  const [storage, ai] = await Promise.all([storageOf(ids), aiOf(ids)]);
  return { storage, ai, societies: ids };
}
/** One Society's own storage (for showing its share). */
export const societyStorage = (societyId: number) => storageOf([societyId]);

export function formatBytes(n: number): string {
  if (n >= GB) return `${+(n / GB).toFixed(1)} GB`;
  if (n >= MB) return `${Math.round(n / MB)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** A refused plan check: HTTP 402, and the page can offer an upgrade. */
export const planRefusal = (error: string) => NextResponse.json({ error, upgrade: true }, { status: 402 });
