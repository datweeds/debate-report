// A Society's News tab, backed by the News service (news.new.vote): each
// Society with News has one subscription there, defined by its sections.
// Editions arrive by signed webhook (and are pulled as a fallback) and are
// kept here as delivered. Server-only.

import crypto from 'crypto';
import { notifyNew } from './notify';
import pool from './db';
import { loadSocietyAi } from './ai/gateway';
import { decryptSecret } from './ai/secrets';

const NEWS_URL = process.env.NEWS_API_URL ?? '';
const NEWS_KEY = process.env.NEWS_API_KEY ?? '';
const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL ?? '').replace(/\/$/, '');

export const newsConfigured = () => !!(NEWS_URL && NEWS_KEY);

export class NewsError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

export async function newsFetch<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!newsConfigured()) throw new NewsError('News is not configured on this server', 503);
  let res: Response;
  try {
    res = await fetch(`${NEWS_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: { Authorization: `Bearer ${NEWS_KEY}`, ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(60_000),
      cache: 'no-store',
    });
  } catch {
    throw new NewsError('The News service is not responding');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { detail?: unknown }).detail;
    const message = typeof detail === 'string' ? detail
      : Array.isArray(detail) ? detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join('; ')
      : `News service error (${res.status})`;
    throw new NewsError(message, res.status >= 500 ? 502 : res.status);
  }
  return data as T;
}

// ── Settings ─────────────────────────────────────────────────────────────────

export type NewsLocation = {
  name: string; kind: 'country' | 'admin1' | 'place'; geonames_id: number | null;
  country: string; admin1: string | null; lat: number | null; lon: number | null; radius_km?: number;
};

export type NewsSection = {
  id: string; heading: string; phrases: string; must_include: string | null; must_exclude: string | null; sort_order: number;
};

export type NewsSettings = {
  enabled: boolean; title: string | null; cadence: 'daily' | 'weekly'; publish_time: string; publish_weekday: number;
  locations: NewsLocation[]; min_score: number; max_items: number; use_llm: boolean;
  include_papers: boolean;   // scientific papers and preprints in a research part of each edition
  subscription_id: string | null; sections: NewsSection[];
};

export const DEFAULT_SETTINGS: Omit<NewsSettings, 'sections' | 'subscription_id'> = {
  enabled: true, title: null, cadence: 'daily', publish_time: '07:00', publish_weekday: 0,
  locations: [], min_score: 35, max_items: 12, use_llm: true, include_papers: false,
};

export function editionTitle(societyName: string, s: { title: string | null; cadence: string }) {
  return s.title?.trim() || `${societyName} ${s.cadence === 'weekly' ? 'Weekly' : 'Daily'} News`;
}

export async function loadSettings(societyId: number): Promise<NewsSettings | null> {
  const { rows: [row] } = await pool.query('SELECT * FROM society_news WHERE customer_id = $1', [societyId]);
  if (!row) return null;
  const { rows: sections } = await pool.query(
    `SELECT id, heading, phrases, must_include, must_exclude, sort_order FROM society_news_sections
     WHERE customer_id = $1 ORDER BY sort_order, created_at`, [societyId]);
  return {
    enabled: row.enabled, title: row.title, cadence: row.cadence, publish_time: row.publish_time,
    publish_weekday: row.publish_weekday, locations: row.locations, min_score: row.min_score,
    max_items: row.max_items, use_llm: row.use_llm, include_papers: row.include_papers ?? false,
    subscription_id: row.subscription_id, sections,
  };
}

const lines = (s: string | null) => (s ?? '').split('\n').map(x => x.trim()).filter(Boolean);
const commas = (s: string | null) => (s ?? '').split(',').map(x => x.trim()).filter(Boolean);

// The subscription definition News expects, from a Society's settings.
// AI write-ups need both the News switch and the Society's AI not to be off.
export function definition(societyName: string, s: Omit<NewsSettings, 'subscription_id'>, aiMode = 'platform') {
  return {
    use_llm: s.use_llm && aiMode !== 'off',
    name: editionTitle(societyName, s),
    sections: s.sections.map(sec => ({
      key: sec.id, heading: sec.heading, phrases: lines(sec.phrases),
      must_include: commas(sec.must_include), must_exclude: commas(sec.must_exclude),
    })),
    locations: s.locations.map(l => ({
      name: l.name, kind: l.kind, geonames_id: l.geonames_id, country: l.country, admin1: l.admin1,
      lat: l.lat, lon: l.lon, radius_km: l.radius_km ?? 25,
    })),
    min_score: s.min_score,
    max_items: s.max_items,
    include_papers: s.include_papers,
  };
}

export function schedule(s: Pick<NewsSettings, 'cadence' | 'publish_time' | 'publish_weekday'>) {
  return { cadence: s.cadence, time: s.publish_time, weekday: s.publish_weekday, tz: 'Europe/London' };
}

type Subscription = { id: string; webhook_secret?: string | null };

// Create or update the Society's subscription in News to match its settings,
// including its own AI provider (used by News for writing its editions)
export async function syncSubscription(societyId: number, societyName: string): Promise<void> {
  const s = await loadSettings(societyId);
  if (!s) return;
  const ai = await loadSocietyAi(societyId);
  const active = s.enabled && s.sections.length > 0;
  let subscriptionId = s.subscription_id;
  if (!subscriptionId) {
    if (!active) return;
    const sub = await newsFetch<Subscription>('/v1/subscriptions', {
      method: 'POST',
      body: {
        external_ref: `society:${societyId}`, definition: definition(societyName, s, ai?.mode), schedule: schedule(s),
        webhook_url: BASE_URL ? `${BASE_URL}/api/news/webhook` : undefined, active,
      },
    });
    await pool.query('UPDATE society_news SET subscription_id = $2, webhook_secret = $3 WHERE customer_id = $1',
      [societyId, sub.id, sub.webhook_secret ?? null]);
    subscriptionId = sub.id;
  } else {
    await newsFetch(`/v1/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      body: s.sections.length
        ? { definition: definition(societyName, s, ai?.mode), schedule: schedule(s), active }
        : { active: false },
    });
  }
  if (ai?.mode === 'own' && ai.adapter && (ai.model_standard || ai.model_light)) {
    await newsFetch(`/v1/subscriptions/${subscriptionId}/llm`, {
      method: 'PUT',
      body: {
        adapter: ai.adapter, base_url: ai.base_url, model: ai.model_standard || ai.model_light,
        input_usd_per_mtok: ai.standard_in_usd, output_usd_per_mtok: ai.standard_out_usd,
        monthly_budget_usd: ai.monthly_budget_usd, api_key: ai.secret_enc ? decryptSecret(ai.secret_enc) : null,
      },
    });
  } else {
    await newsFetch(`/v1/subscriptions/${subscriptionId}/llm`, { method: 'DELETE' });
  }
}

// ── Editions ─────────────────────────────────────────────────────────────────

export type Digest = {
  id: string; external_ref: string | null; edition_date: string; cadence: string; overview: string | null;
  items: Record<string, unknown>[]; papers?: Record<string, unknown>[]; created_at: string;
};

export async function storeEdition(societyId: number, d: Digest) {
  const { rowCount } = await pool.query(
    `INSERT INTO society_news_editions (customer_id, digest_id, edition_date, cadence, overview, items, item_count, papers)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (digest_id) DO NOTHING`,
    [societyId, d.id, d.edition_date, d.cadence, d.overview, JSON.stringify(d.items), d.items.length, JSON.stringify(d.papers ?? [])],
  );
  // A new, recent edition (not one caught up from days ago): tell the members
  const recent = Date.now() - new Date(d.edition_date).getTime() < 2 * 86400_000;
  if (rowCount && recent) notifyNew({
    societyId, kind: 'news', authorId: null, private: true,
    heading: 'A new News edition for {society}', url: `/society/${societyId}/news`,
  });
}

// Fetch editions the webhook may have missed (at most every 10 minutes)
export async function pullEditions(societyId: number, force = false) {
  const { rows: [row] } = await pool.query(
    `UPDATE society_news SET last_synced_at = now()
     WHERE customer_id = $1 AND subscription_id IS NOT NULL
       AND ($2 OR last_synced_at IS NULL OR last_synced_at < now() - interval '10 minutes')
     RETURNING subscription_id`, [societyId, force]);
  if (!row) return;
  const { rows: [latest] } = await pool.query(
    'SELECT max(created_at) AS at FROM society_news_editions WHERE customer_id = $1', [societyId]);
  const since = latest?.at ? `&since=${encodeURIComponent(new Date(new Date(latest.at).getTime() - 3600_000).toISOString())}` : '';
  const { digests } = await newsFetch<{ digests: Digest[] }>(`/v1/subscriptions/${row.subscription_id}/digests?limit=20${since}`);
  for (const d of digests) await storeEdition(societyId, d);
}

// Tell News someone is reading (at most hourly). In "auto" mode, News only
// spends on its LLM while editions are being read.
export async function reportRead(societyId: number) {
  const { rows: [row] } = await pool.query(
    `UPDATE society_news SET last_read_at = now()
     WHERE customer_id = $1 AND subscription_id IS NOT NULL
       AND (last_read_at IS NULL OR last_read_at < now() - interval '1 hour')
     RETURNING subscription_id`, [societyId]);
  if (row) await newsFetch(`/v1/subscriptions/${row.subscription_id}/read`, { method: 'POST' }).catch(() => {});
}

// X-News-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<body>">, at most 5 minutes old
export function verifySignature(body: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=', 2) as [string, string]));
  const t = Number(parts.t);
  if (!t || !parts.v1 || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  const a = Buffer.from(parts.v1, 'hex'), b = Buffer.from(expected, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
