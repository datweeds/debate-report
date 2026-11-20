// The AI gateway: every AI feature asks for a task, and the gateway decides
// which provider and model run it, or that AI is unavailable (the feature
// then uses its non-AI fallback). Server-only.
//
// Routes, per Society:
//   own      - the Society's own provider, within its monthly budget. If that
//              fails or the budget is spent, AI is unavailable: work is never
//              moved onto the platform's bill.
//   platform - the platform's provider, unless the site switch is off or the
//              site's daily cap (shared with the News service) is reached.
//   off      - no AI for this Society.
// Every call is logged in ai_calls (task, route, tokens, cost; no content).

import pool from '@/lib/db';
import { decryptSecret } from './secrets';
import { complete, ProviderError, type Completion, type ProviderConfig } from './providers';
import type { Adapter } from './presets';

export class AiUnavailable extends Error {}

export type Tier = 'light' | 'standard';

// The platform's own models, first available wins (unknown model → next).
// Prices in USD per million tokens, for the shared daily cap.
const PLATFORM: Record<Tier, { models: string[]; inPrice: number; outPrice: number }> = {
  light:    { models: ['claude-haiku-5-5'], inPrice: 1, outPrice: 5 },
  standard: { models: ['claude-sonnet-5-5', 'claude-sonnet-5'], inPrice: 3, outPrice: 15 },
};

export type SocietyAi = {
  customer_id: number; mode: 'platform' | 'own' | 'off'; preset: string | null; adapter: Adapter | null;
  base_url: string | null; model_light: string | null; model_standard: string | null; secret_enc: string | null;
  light_in_usd: number; light_out_usd: number; standard_in_usd: number; standard_out_usd: number;
  monthly_budget_usd: number | null; last_test: Record<string, unknown> | null; updated_at: string | null;
};

export async function loadSocietyAi(societyId: number): Promise<SocietyAi | null> {
  const { rows: [r] } = await pool.query('SELECT * FROM society_ai WHERE customer_id = $1', [societyId]);
  if (!r) return null;
  for (const k of ['light_in_usd', 'light_out_usd', 'standard_in_usd', 'standard_out_usd', 'monthly_budget_usd'] as const) {
    r[k] = r[k] === null ? null : Number(r[k]);
  }
  return r;
}

const cost = (tokensIn: number, tokensOut: number, inPrice: number, outPrice: number) =>
  (tokensIn * inPrice + tokensOut * outPrice) / 1_000_000;

// ── Spend ────────────────────────────────────────────────────────────────────

// The platform's own spend today, here and in the News service
type PlatformStatus = { mode: 'off' | 'on' | 'auto'; dailyBudgetUsd: number; newsSpentTodayUsd: number; reachable: boolean };
let statusCache: { at: number; value: PlatformStatus } | null = null;

export async function platformStatus(fresh = false): Promise<PlatformStatus> {
  if (!fresh && statusCache && Date.now() - statusCache.at < 60_000) return statusCache.value;
  let value: PlatformStatus = { mode: 'on', dailyBudgetUsd: Number(process.env.AI_DAILY_BUDGET_USD ?? 1), newsSpentTodayUsd: 0, reachable: false };
  const url = process.env.NEWS_API_URL, key = process.env.NEWS_ADMIN_KEY;
  if (url && key) {
    try {
      const r = await fetch(`${url}/v1/admin/metrics/llm?days=1`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000), cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        value = { mode: d.mode, dailyBudgetUsd: d.daily_budget_usd, newsSpentTodayUsd: d.spent_today_usd, reachable: true };
      }
    } catch { /* News unreachable: keep defaults */ }
  }
  statusCache = { at: Date.now(), value };
  return value;
}
export const invalidatePlatformStatus = () => { statusCache = null; };

async function spent(where: string, params: unknown[]): Promise<number> {
  const { rows: [r] } = await pool.query(`SELECT COALESCE(sum(cost_usd), 0)::float AS n FROM ai_calls WHERE ${where}`, params);
  return r.n;
}
export const platformSpentToday = () => spent(`scope = 'platform' AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`, []);
export const ownSpentThisMonth = (societyId: number) =>
  spent(`scope = 'own' AND customer_id = $1 AND created_at >= date_trunc('month', now())`, [societyId]);

// The Society's own provider's spend this month in the News service
async function newsOwnSpentThisMonth(societyId: number): Promise<number> {
  const { rows: [n] } = await pool.query('SELECT subscription_id FROM society_news WHERE customer_id = $1', [societyId]);
  const url = process.env.NEWS_API_URL, key = process.env.NEWS_API_KEY;
  if (!n?.subscription_id || !url || !key) return 0;
  try {
    const r = await fetch(`${url}/v1/subscriptions/${n.subscription_id}/usage?days=31`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000), cache: 'no-store' });
    return r.ok ? Number((await r.json()).own?.month_usd ?? 0) : 0;
  } catch { return 0; }
}

// ── Routing ──────────────────────────────────────────────────────────────────

type Route = { scope: 'platform' | 'own'; provider: ProviderConfig; providerName: string; models: string[]; inPrice: number; outPrice: number };

export async function resolveRoute(societyId: number | null, tier: Tier, estimateTokens: { in: number; out: number }): Promise<Route> {
  const s = societyId ? await loadSocietyAi(societyId) : null;
  if (s?.mode === 'off') throw new AiUnavailable('AI is switched off for this Society.');
  if (s?.mode === 'own') {
    const model = tier === 'light' ? (s.model_light || s.model_standard) : (s.model_standard || s.model_light);
    if (!s.adapter || !model) throw new AiUnavailable('This Society’s AI provider isn’t fully set up.');
    const inPrice = tier === 'light' ? s.light_in_usd : s.standard_in_usd;
    const outPrice = tier === 'light' ? s.light_out_usd : s.standard_out_usd;
    if (s.monthly_budget_usd !== null) {
      const used = await ownSpentThisMonth(s.customer_id) + await newsOwnSpentThisMonth(s.customer_id);
      if (used + cost(estimateTokens.in, estimateTokens.out, inPrice, outPrice) > s.monthly_budget_usd) {
        throw new AiUnavailable('This Society’s AI budget for the month has been reached.');
      }
    }
    let apiKey: string | null = null;
    try { apiKey = s.secret_enc ? decryptSecret(s.secret_enc) : null; } catch { throw new AiUnavailable('This Society’s AI key can’t be read; please enter it again.'); }
    return { scope: 'own', provider: { adapter: s.adapter, baseUrl: s.base_url, apiKey }, providerName: s.preset ?? s.adapter, models: [model], inPrice, outPrice };
  }
  const status = await platformStatus();
  if (status.mode === 'off') throw new AiUnavailable('AI is switched off for the whole site.');
  const p = PLATFORM[tier];
  const used = status.newsSpentTodayUsd + await platformSpentToday();
  if (used + cost(estimateTokens.in, estimateTokens.out, p.inPrice, p.outPrice) > status.dailyBudgetUsd) {
    throw new AiUnavailable('new.vote’s shared daily AI budget, used by every Society on new.vote’s AI, has run out for today; it resets at midnight (UK time).');
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new AiUnavailable('AI isn’t configured on this server.');
  return { scope: 'platform', provider: { adapter: 'anthropic', baseUrl: null, apiKey: process.env.ANTHROPIC_API_KEY }, providerName: 'platform', models: p.models, inPrice: p.inPrice, outPrice: p.outPrice };
}

async function logCall(row: { task: string; societyId: number | null; scope: string; provider: string; model: string | null;
  status: string; tokensIn?: number; tokensOut?: number; costUsd?: number; latencyMs?: number; error?: string | null }) {
  await pool.query(
    `INSERT INTO ai_calls (task, customer_id, scope, provider, model, status, tokens_in, tokens_out, cost_usd, latency_ms, error)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [row.task, row.societyId, row.scope, row.provider, row.model, row.status, row.tokensIn ?? 0, row.tokensOut ?? 0,
     row.costUsd ?? 0, row.latencyMs ?? null, row.error?.slice(0, 500) ?? null],
  ).catch(err => console.error('[ai] log', err));
}

// Run a task. Throws AiUnavailable when no route may be used (the caller
// shows its fallback) and ProviderError when the provider fails.
export async function aiComplete(opts: {
  task: string; tier: Tier; societyId: number | null; system: string; user: string; maxTokens: number;
}): Promise<Completion & { scope: 'platform' | 'own' }> {
  const estimate = { in: Math.ceil((opts.system.length + opts.user.length) / 3), out: opts.maxTokens };
  let route: Route;
  try {
    route = await resolveRoute(opts.societyId, opts.tier, estimate);
  } catch (err) {
    if (err instanceof AiUnavailable) {
      await logCall({ task: opts.task, societyId: opts.societyId, scope: 'none', provider: '-', model: null, status: 'skipped', error: err.message });
    }
    throw err;
  }
  let lastErr: unknown;
  for (const model of route.models) {
    const started = Date.now();
    try {
      const out = await complete(route.provider, model, opts.system, opts.user, opts.maxTokens);
      await logCall({
        task: opts.task, societyId: opts.societyId, scope: route.scope, provider: route.providerName, model: out.model,
        status: 'ok', tokensIn: out.tokensIn, tokensOut: out.tokensOut,
        costUsd: cost(out.tokensIn, out.tokensOut, route.inPrice, route.outPrice), latencyMs: Date.now() - started,
      });
      return { ...out, scope: route.scope };
    } catch (err) {
      lastErr = err;
      await logCall({ task: opts.task, societyId: opts.societyId, scope: route.scope, provider: route.providerName, model,
        status: 'error', latencyMs: Date.now() - started, error: (err as Error).message });
      // Unknown model → try the next one; anything else is a real failure
      if (!(err instanceof ProviderError && err.status === 404)) break;
    }
  }
  throw lastErr;
}
