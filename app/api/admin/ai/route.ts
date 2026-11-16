import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { invalidatePlatformStatus } from '@/lib/ai/gateway';

const NEWS_URL = process.env.NEWS_API_URL ?? '';
const ADMIN_KEY = process.env.NEWS_ADMIN_KEY ?? '';

async function newsAdmin(path: string, init: { method?: string; body?: unknown } = {}) {
  if (!NEWS_URL || !ADMIN_KEY) return null;
  const r = await fetch(`${NEWS_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${ADMIN_KEY}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined, signal: AbortSignal.timeout(10_000), cache: 'no-store',
  }).catch(() => null);
  if (!r) return null;
  const d = await r.json().catch(() => null);
  return r.ok ? d : { error: typeof d?.detail === 'string' ? d.detail : `News replied ${r.status}` };
}

// GET — AI across the site: the switch and daily cap, spend by day and task,
// and each Society's AI choice and spend. SysAdmin (also checked by proxy.ts).
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const days = 30;
  const [news, { rows: calls }, { rows: societies }] = await Promise.all([
    newsAdmin(`/v1/admin/metrics/llm?days=${days}`),
    pool.query(
      `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, task, scope,
              count(*) FILTER (WHERE status = 'ok')::int AS calls, count(*) FILTER (WHERE status = 'error')::int AS errors,
              count(*) FILTER (WHERE status = 'skipped')::int AS skipped,
              COALESCE(sum(tokens_in), 0)::int AS tokens_in, COALESCE(sum(tokens_out), 0)::int AS tokens_out,
              COALESCE(sum(cost_usd), 0)::float AS cost_usd
       FROM ai_calls WHERE created_at > now() - make_interval(days => $1)
       GROUP BY 1, 2, 3 ORDER BY 1 DESC, 2`, [days]),
    pool.query(
      `SELECT c.id, c.name, COALESCE(a.mode, 'platform') AS mode, a.preset, a.model_standard, a.monthly_budget_usd::float,
              n.enabled AS news_enabled, n.use_llm AS news_use_llm,
              COALESCE((SELECT sum(cost_usd) FROM ai_calls x WHERE x.customer_id = c.id AND x.scope = 'platform'
                        AND x.created_at > now() - make_interval(days => $1)), 0)::float AS platform_usd,
              COALESCE((SELECT sum(cost_usd) FROM ai_calls x WHERE x.customer_id = c.id AND x.scope = 'own'
                        AND x.created_at > now() - make_interval(days => $1)), 0)::float AS own_usd
       FROM customers c LEFT JOIN society_ai a ON a.customer_id = c.id LEFT JOIN society_news n ON n.customer_id = c.id
       ORDER BY c.name`, [days]),
  ]);

  // Add each Society's News spend (attributed by the News service)
  const newsBySociety = new Map<number, { platform: number; own: number }>();
  for (const s of news?.by_subscription ?? []) {
    const m = /^society:(\d+)$/.exec(s.external_ref ?? '');
    if (m) newsBySociety.set(Number(m[1]), { platform: s.platform_period_usd, own: s.own_period_usd });
  }
  const { rows: [today] } = await pool.query(
    `SELECT COALESCE(sum(cost_usd), 0)::float AS n FROM ai_calls
     WHERE scope = 'platform' AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`);

  return NextResponse.json({
    newsReachable: !!news && !news.error,
    mode: news?.mode ?? null,
    daily_budget_usd: news?.daily_budget_usd ?? null,
    spent_today_usd: (news?.spent_today_usd ?? 0) + today.n,
    news_spent_today_usd: news?.spent_today_usd ?? 0,
    site_spent_today_usd: today.n,
    available: news?.llm_available_now ?? null,
    reason: news?.reason ?? null,
    newsUsage: news?.usage ?? [],
    siteUsage: calls,
    societies: societies
      .map(s => ({ ...s, news_platform_usd: newsBySociety.get(s.id)?.platform ?? 0, news_own_usd: newsBySociety.get(s.id)?.own ?? 0 }))
      .filter(s => s.mode !== 'platform' || s.platform_usd || s.own_usd || s.news_platform_usd || s.news_own_usd || s.news_enabled !== null),
  });
}

// PUT { mode?, daily_budget_usd? } — the site-wide AI switch and daily cap
export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const body: Record<string, unknown> = {};
  if (['off', 'on', 'auto'].includes(b.mode)) body.mode = b.mode;
  if (b.daily_budget_usd !== undefined) {
    const n = Number(b.daily_budget_usd);
    if (!(n >= 0 && n <= 10000)) return NextResponse.json({ error: 'The daily cap must be between $0 and $10,000' }, { status: 400 });
    body.daily_budget_usd = n;
  }
  const r = await newsAdmin('/v1/admin/settings/llm', { method: 'PUT', body });
  if (!r || r.error) return NextResponse.json({ error: r?.error ?? 'The News service is not reachable' }, { status: 502 });
  invalidatePlatformStatus();
  return NextResponse.json({ ok: true, mode: r.mode, daily_budget_usd: r.daily_budget_usd });
}
