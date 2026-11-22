import type Stripe from 'stripe';
import { sendMemberNotice } from './postmark';
import stripe, { BASE_URL } from './stripe';
import pool from './db';

// ── Billing for new.vote ─────────────────────────────────────────────────────
//
// The Stripe account is shared with poll.voter.care, so everything new.vote
// creates carries metadata app=newvote, and the webhook ignores anything else.
//
// Pricing isn't settled, so no plan is named in code. A price is on sale when, in
// Stripe, it is active, has a lookup key starting "nv_", and its product has
// metadata app=newvote. The product (or price) metadata also says:
//   plan  the plan key the app checks, e.g. "moderator" or "society_plus"
//   for   who buys it: "user" (a person) or "society" (a Society, paid by its moderators)
// New plans or prices are therefore set up in Stripe, with no code change.

export const APP = 'newvote';
export type Owner = { kind: 'user'; id: string } | { kind: 'society'; id: number };
/** Statuses that still give access (past_due: Stripe is retrying the card). */
export const LIVE_STATUSES = ['active', 'trialing', 'past_due'];

const ownerMeta = (o: Owner) => ({ app: APP, owner_kind: o.kind, owner_id: String(o.id) });

// ── Price catalogue ──────────────────────────────────────────────────────────

export type CatalogPrice = {
  lookupKey: string; priceId: string; plan: string; for: 'user' | 'society';
  product: string; description: string | null;
  amount: number | null; currency: string; interval: string | null; intervalCount: number | null;
};

let cache: { at: number; list: CatalogPrice[] } | null = null;

/** Prices on sale for new.vote, cached for five minutes. */
export async function catalogue(fresh = false): Promise<CatalogPrice[]> {
  if (!fresh && cache && Date.now() - cache.at < 5 * 60_000) return cache.list;
  const list: CatalogPrice[] = [];
  for await (const p of stripe.prices.list({ active: true, limit: 100, expand: ['data.product'] })) {
    const prod = p.product as Stripe.Product;
    if (!p.lookup_key?.startsWith('nv_') || typeof prod !== 'object' || !prod.active || prod.metadata?.app !== APP) continue;
    const plan = p.metadata?.plan || prod.metadata?.plan;
    if (!plan) continue;
    list.push({
      lookupKey: p.lookup_key, priceId: p.id, plan,
      for: (p.metadata?.for || prod.metadata?.for) === 'society' ? 'society' : 'user',
      product: prod.name, description: prod.description ?? null,
      amount: p.unit_amount, currency: p.currency,
      interval: p.recurring?.interval ?? null, intervalCount: p.recurring?.interval_count ?? null,
    });
  }
  list.sort((a, b) => a.product.localeCompare(b.product) || (a.amount ?? 0) - (b.amount ?? 0));
  cache = { at: Date.now(), list };
  return list;
}

// ── Stripe customers ─────────────────────────────────────────────────────────

async function storedCustomer(o: Owner): Promise<string | null> {
  const { rows: [r] } = o.kind === 'user'
    ? await pool.query('SELECT stripe_customer_id AS c FROM users WHERE id = $1', [o.id])
    : await pool.query('SELECT stripe_customer_id AS c FROM customers WHERE id = $1', [o.id]);
  return r?.c ?? null;
}

/** The owner's Stripe customer, created on first use. */
export async function ensureCustomer(o: Owner): Promise<string> {
  const have = await storedCustomer(o);
  if (have) return have;

  let name: string | undefined, email: string | undefined;
  if (o.kind === 'user') {
    const { rows: [u] } = await pool.query('SELECT user_handle, email FROM users WHERE id = $1', [o.id]);
    if (!u) throw new Error('Account not found');
    name = u.user_handle; email = u.email ?? undefined;
  } else {
    const { rows: [s] } = await pool.query('SELECT name, contact_email FROM customers WHERE id = $1', [o.id]);
    if (!s) throw new Error('Society not found');
    name = s.name; email = s.contact_email ?? undefined;
  }
  const c = await stripe.customers.create({ name, email, metadata: ownerMeta(o) });

  // Two tabs at once: keep whichever customer was saved first
  const { rowCount } = o.kind === 'user'
    ? await pool.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2 AND stripe_customer_id IS NULL', [c.id, o.id])
    : await pool.query('UPDATE customers SET stripe_customer_id = $1 WHERE id = $2 AND stripe_customer_id IS NULL', [c.id, o.id]);
  if (rowCount) return c.id;
  await stripe.customers.del(c.id).catch(() => {});
  return (await storedCustomer(o))!;
}

// ── Checkout and the billing portal ──────────────────────────────────────────

export class BillingError extends Error { status = 400; }

/** A Stripe Checkout page for one price; returns its URL. */
export async function startCheckout(o: Owner, lookupKey: string, startedBy: string, returnPath: string): Promise<string> {
  const price = (await catalogue()).find(p => p.lookupKey === lookupKey);
  if (!price) throw new BillingError('That plan isn’t available.');
  if (price.for !== o.kind) throw new BillingError(price.for === 'society' ? 'That plan is for a Society.' : 'That plan is for a person, not a Society.');
  const live = (await subscriptionsOf(o)).filter(s => LIVE_STATUSES.includes(s.status));
  if (live.some(s => s.plan === price.plan)) throw new BillingError('This plan is already active. Use Manage billing to change it.');
  if (live.length) throw new BillingError('You already have a plan: switch it instead of taking out another.');

  const customer = await ensureCustomer(o);
  const meta = { ...ownerMeta(o), started_by: startedBy };
  const back = safePath(returnPath);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [{ price: price.priceId, quantity: 1 }],
    client_reference_id: `${o.kind}:${o.id}`,
    metadata: meta,
    subscription_data: { metadata: meta },
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    customer_update: { address: 'auto', name: 'auto' },
    ...(process.env.STRIPE_AUTOMATIC_TAX === '1' ? { automatic_tax: { enabled: true } } : {}),
    success_url: `${BASE_URL}/stripe/success?session_id={CHECKOUT_SESSION_ID}&next=${encodeURIComponent(back)}`,
    cancel_url: `${BASE_URL}${back}`,
  });
  if (!session.url) throw new Error('Stripe returned no checkout URL');
  return session.url;
}

/** Stripe's billing portal (card, invoices, cancel) for the owner; returns its URL. */
export async function portalUrl(o: Owner, returnPath: string): Promise<string> {
  const customer = await storedCustomer(o);
  if (!customer) throw new BillingError('There’s no billing account yet.');
  const s = await stripe.billingPortal.sessions.create({
    customer,
    return_url: `${BASE_URL}${safePath(returnPath)}`,
    ...(process.env.STRIPE_PORTAL_CONFIG ? { configuration: process.env.STRIPE_PORTAL_CONFIG } : {}),
  });
  return s.url;
}

// Only our own pages, never an outside address
function safePath(p: string): string {
  return typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') && !p.includes('\\') ? p : '/dashboard/billing';
}

// ── What an owner has ────────────────────────────────────────────────────────

export type SubRow = {
  id: string; status: string; plan: string | null; lookup_key: string | null;
  current_period_end: string | null; cancel_at_period_end: boolean; trial_end: string | null;
};

export async function subscriptionsOf(o: Owner): Promise<SubRow[]> {
  const { rows } = await pool.query<SubRow>(
    `SELECT id, status, plan, lookup_key, current_period_end, cancel_at_period_end, trial_end
       FROM billing_subscriptions WHERE ${o.kind === 'user' ? 'user_id' : 'society_id'} = $1
      ORDER BY created_at DESC`, [o.id]);
  return rows;
}

/** The plan keys the owner has right now. */
export async function plansOf(o: Owner): Promise<string[]> {
  return (await subscriptionsOf(o)).filter(s => LIVE_STATUSES.includes(s.status) && s.plan).map(s => s.plan!);
}

export async function hasPlan(o: Owner, plan?: string): Promise<boolean> {
  const p = await plansOf(o);
  return plan ? p.includes(plan) : p.length > 0;
}

// ── Keeping the mirror in step with Stripe ───────────────────────────────────

async function ownerOf(sub: Stripe.Subscription): Promise<Owner | null> {
  const m = sub.metadata ?? {};
  if (m.app === APP && m.owner_kind === 'user' && m.owner_id) return { kind: 'user', id: m.owner_id };
  if (m.app === APP && m.owner_kind === 'society' && Number(m.owner_id)) return { kind: 'society', id: Number(m.owner_id) };
  // Made some other way (e.g. in the Stripe dashboard): go by the customer
  const cid = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const { rows: [u] } = await pool.query('SELECT id FROM users WHERE stripe_customer_id = $1', [cid]);
  if (u) return { kind: 'user', id: u.id };
  const { rows: [s] } = await pool.query('SELECT id FROM customers WHERE stripe_customer_id = $1', [cid]);
  if (s) return { kind: 'society', id: s.id };
  return null;
}

/**
 * Fetch the subscription from Stripe and save it. Always reads Stripe's current
 * state, so events arriving late or out of order can't leave a stale copy.
 * Returns false when it isn't a new.vote subscription.
 */
export async function syncSubscription(subId: string): Promise<boolean> {
  const sub = await stripe.subscriptions.retrieve(subId, { expand: ['items.data.price.product'] });
  const o = await ownerOf(sub);
  if (!o) return false;
  // Gone already (a deleted Society, or a deleted and anonymised account): its
  // plans were cancelled on the way out, and nothing should point back at it
  const { rowCount: still } = o.kind === 'user'
    ? await pool.query(`SELECT 1 FROM users WHERE id = $1 AND user_status IS DISTINCT FROM 'closed'`, [o.id])
    : await pool.query('SELECT 1 FROM customers WHERE id = $1', [o.id]);
  if (!still) {
    await pool.query('DELETE FROM billing_subscriptions WHERE id = $1', [sub.id]);
    return false;
  }
  const item = sub.items.data[0];
  const price = item?.price;
  const prod = price?.product as Stripe.Product | undefined;
  const ts = (n?: number | null) => (n ? new Date(n * 1000) : null);
  const startedBy = /^[0-9a-f-]{36}$/i.test(sub.metadata?.started_by ?? '') ? sub.metadata.started_by : null;
  const cid = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const { rows: [before] } = await pool.query('SELECT status, plan FROM billing_subscriptions WHERE id = $1', [sub.id]);
  const plan = price?.metadata?.plan || prod?.metadata?.plan || null;

  await pool.query(
    `INSERT INTO billing_subscriptions
       (id, stripe_customer_id, user_id, society_id, started_by, status, plan, price_id, lookup_key, quantity,
        current_period_end, cancel_at_period_end, canceled_at, trial_end)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status, plan = EXCLUDED.plan, price_id = EXCLUDED.price_id, lookup_key = EXCLUDED.lookup_key,
       quantity = EXCLUDED.quantity, current_period_end = EXCLUDED.current_period_end,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end, canceled_at = EXCLUDED.canceled_at,
       trial_end = EXCLUDED.trial_end, updated_at = NOW()`,
    [sub.id, cid, o.kind === 'user' ? o.id : null, o.kind === 'society' ? o.id : null, startedBy, sub.status,
     plan, price?.id ?? null, price?.lookup_key ?? null, item?.quantity ?? null,
     ts(item?.current_period_end), !!sub.cancel_at_period_end || !!sub.cancel_at, ts(sub.canceled_at), ts(sub.trial_end)]);

  // Tell the team when a plan starts (or changes)
  const live = LIVE_STATUSES.includes(sub.status), wasLive = !!before && LIVE_STATUSES.includes(before.status);
  if (live && (!wasLive || before.plan !== plan)) {
    void planAlert({ subId: sub.id, owner: o, productName: prod?.name ?? plan ?? 'a plan', amount: price?.unit_amount ?? null, currency: price?.currency ?? 'gbp',
      interval: price?.recurring?.interval ?? null, status: sub.status, startedBy, changedFrom: wasLive ? before.plan : null }).catch(err => console.error('[billing] plan alert', err));
  }

  // A person's paid flag, which their session carries
  if (o.kind === 'user') {
    await pool.query(
      `UPDATE users SET user_plan = CASE WHEN EXISTS (SELECT 1 FROM billing_subscriptions
           WHERE user_id = $1 AND status = ANY($2)) THEN 'paid' ELSE 'free' END, updated_at = NOW() WHERE id = $1`,
      [o.id, LIVE_STATUSES]);
  }
  return true;
}

/**
 * Stop billing an owner straight away (account or Society being deleted).
 * Throws if Stripe can't be reached, so nothing is deleted while still charging.
 */
export async function cancelAllFor(o: Owner): Promise<void> {
  for (const s of await subscriptionsOf(o)) {
    if (['canceled', 'incomplete_expired'].includes(s.status)) continue;
    try {
      await stripe.subscriptions.cancel(s.id);
    } catch (e) {
      if ((e as { code?: string }).code !== 'resource_missing') throw e;
    }
    await pool.query(`UPDATE billing_subscriptions SET status = 'canceled', canceled_at = NOW(), updated_at = NOW() WHERE id = $1`, [s.id]);
  }
}

/** Email the team's inbox about a new (or changed) plan. */
async function planAlert(a: { subId: string; owner: Owner; productName: string; amount: number | null; currency: string; interval: string | null;
  status: string; startedBy: string | null; changedFrom: string | null }) {
  const [{ rows: [who] }, { rows: [by] }] = await Promise.all([
    a.owner.kind === 'society'
      ? pool.query('SELECT name, subdomain FROM customers WHERE id = $1', [a.owner.id])
      : pool.query('SELECT user_handle AS name FROM users WHERE id = $1', [a.owner.id]),
    a.startedBy ? pool.query('SELECT user_handle FROM users WHERE id = $1', [a.startedBy]) : Promise.resolve({ rows: [] as { user_handle: string }[] }),
  ]);
  const money = a.amount != null ? `${new Intl.NumberFormat('en-GB', { style: 'currency', currency: a.currency.toUpperCase() }).format(a.amount / 100)}${a.interval ? ` a ${a.interval}` : ''}` : '';
  const forWhom = a.owner.kind === 'society' ? `the Society “${who?.name ?? a.owner.id}” (${BASE_URL}/society/${who?.subdomain || a.owner.id})` : `the account @${who?.name ?? a.owner.id}`;
  const subject = `new.vote: ${a.changedFrom ? 'plan changed to' : 'new plan,'} ${a.productName}${money ? ` (${money})` : ''}`;
  const text = [
    `${a.changedFrom ? `A plan was changed from ${a.changedFrom} to` : 'A new plan was taken out:'} ${a.productName}${money ? `, ${money}` : ''}, for ${forWhom}.`,
    by?.user_handle ? `Started by @${by.user_handle}.` : '',
    `Status: ${a.status}.`,
    `Stripe: https://dashboard.stripe.com/subscriptions/${a.subId}`,
  ].filter(Boolean).join('\n');
  await sendMemberNotice({ to: process.env.PLAN_ALERT_EMAIL ?? process.env.CONTACT_TO_EMAIL ?? 'contact@new.vote', subject, text });
}

/**
 * Switch the owner's live plan to another price (Team ↔ Network, monthly ↔
 * yearly). Stripe charges or credits the difference at once (proration).
 */
export async function switchPlan(o: Owner, lookupKey: string): Promise<void> {
  const price = (await catalogue(true)).find(p => p.lookupKey === lookupKey);
  if (!price || price.for !== o.kind) throw new BillingError('That plan isn’t available.');
  const live = (await subscriptionsOf(o)).filter(s => LIVE_STATUSES.includes(s.status));
  if (!live.length) throw new BillingError('There’s no plan to switch: choose one instead.');
  const sub = await stripe.subscriptions.retrieve(live[0].id);
  const item = sub.items.data[0];
  if (item.price.id === price.priceId) throw new BillingError('That’s the current plan.');
  await stripe.subscriptions.update(sub.id, {
    items: [{ id: item.id, price: price.priceId }],
    proration_behavior: 'create_prorations',
    cancel_at_period_end: false,
  });
  await syncSubscription(sub.id);
}
