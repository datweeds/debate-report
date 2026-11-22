import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { loadSocietyAi, ownSpentThisMonth, platformSpentToday, platformStatus, resolveRoute, AiUnavailable } from '@/lib/ai/gateway';
import { publicAiSettings, saveAiSettings } from '@/lib/ai/societySettings';
import { localEndpointsAllowed, ProviderError } from '@/lib/ai/providers';
import { secretsAvailable } from '@/lib/ai/secrets';
import { loadSettings, newsFetch, NewsError, syncSubscription } from '@/lib/news';

async function moderatorOnly(req: NextRequest, rawId: string) {
  const a = await societyContentAccess(req, rawId);
  if (!a) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (!a.canModerate) return { error: NextResponse.json({ error: 'Only this Society’s admins can change its AI settings' }, { status: 403 }) };
  return { a };
}

type NewsUsage = {
  days: { day: string; task: string; scope: string; cost_usd: number }[];
  platform: { today_usd: number; month_usd: number; mode: string; available: boolean; reason: string };
  own: { month_usd: number };
};

// GET — the Society's AI settings (never the key), its AI use and spend, and
// whether AI is available to it right now
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { a, error } = await moderatorOnly(req, (await params).id);
  if (error) return error;
  const ai = await loadSocietyAi(a.societyId);
  const news = await loadSettings(a.societyId);

  const { rows: calls } = await pool.query(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, task, scope,
            count(*) FILTER (WHERE status = 'ok')::int AS calls, COALESCE(sum(cost_usd), 0)::float AS cost_usd,
            count(*) FILTER (WHERE status <> 'ok')::int AS not_run
     FROM ai_calls WHERE customer_id = $1 AND created_at > now() - interval '30 days' AND task <> 'ai.test'
     GROUP BY 1, 2, 3 ORDER BY 1 DESC, 2`, [a.societyId]);
  let newsUsage: NewsUsage | null = null;
  if (news?.subscription_id) {
    newsUsage = await newsFetch<NewsUsage>(`/v1/subscriptions/${news.subscription_id}/usage?days=30`).catch(() => null);
  }

  // Is AI available for this Society's own features right now?
  let available = true, reason = '';
  try { await resolveRoute(a.societyId, 'standard', { in: 0, out: 0 }); } catch (err) {
    if (err instanceof AiUnavailable) { available = false; reason = err.message; } else throw err;
  }
  const status = await platformStatus();
  const monthStart = new Date(); monthStart.setUTCDate(1);
  const monthKey = monthStart.toISOString().slice(0, 7);
  const sum = (rows: { day: string; scope: string; cost_usd: number }[], scope: string) =>
    rows.filter(r => r.scope === scope && r.day.startsWith(monthKey)).reduce((n, r) => n + Number(r.cost_usd), 0);

  return NextResponse.json({
    settings: publicAiSettings(ai),
    news: news ? { configured: news.sections.length > 0, enabled: news.enabled, use_llm: news.use_llm } : null,
    available, reason,
    platform: { mode: status.mode, daily_budget_usd: status.dailyBudgetUsd,
      spent_today_usd: status.newsSpentTodayUsd + await platformSpentToday(), reachable: status.reachable },
    month: {
      platform_usd: sum(calls, 'platform') + (newsUsage?.platform.month_usd ?? 0),
      own_usd: (await ownSpentThisMonth(a.societyId)) + (newsUsage?.own.month_usd ?? 0),
    },
    usage: [
      ...calls.map(r => ({ day: r.day, task: r.task, scope: r.scope, calls: r.calls, not_run: r.not_run, cost_usd: r.cost_usd })),
      ...(newsUsage?.days ?? []).map(d => ({ day: String(d.day).slice(0, 10), task: `news.${d.task}`, scope: d.scope, calls: null, not_run: 0, cost_usd: d.cost_usd })),
    ].sort((x, y) => y.day.localeCompare(x.day)),
    allowLocal: localEndpointsAllowed(),
    secretsReady: secretsAvailable(),
  });
}

// PUT — save the AI settings, and the News AI switches; then update News
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { a, error } = await moderatorOnly(req, (await params).id);
  if (error) return error;
  const body = await req.json().catch(() => ({}));
  try {
    if (body.ai) await saveAiSettings(a.societyId, a.session!.sub, body.ai);
  } catch (err) {
    if (err instanceof ProviderError || (err instanceof Error && /AI_SECRET_KEY/.test(err.message))) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
  if (typeof body.news_enabled === 'boolean' || typeof body.news_use_llm === 'boolean') {
    await pool.query(
      `UPDATE society_news SET enabled = COALESCE($2, enabled), use_llm = COALESCE($3, use_llm), updated_by = $4, updated_at = now()
       WHERE customer_id = $1`,
      [a.societyId, typeof body.news_enabled === 'boolean' ? body.news_enabled : null,
       typeof body.news_use_llm === 'boolean' ? body.news_use_llm : null, a.session!.sub]);
  }
  let warning: string | null = null;
  try {
    const { rows: [s] } = await pool.query('SELECT name FROM customers WHERE id = $1', [a.societyId]);
    await syncSubscription(a.societyId, s?.name ?? '');
  } catch (err) {
    warning = err instanceof NewsError ? `Saved, but the News service said: ${err.message}` : 'Saved, but the News service could not be updated';
    console.error('[ai] news sync', err);
  }
  return NextResponse.json({ ok: true, warning, settings: publicAiSettings(await loadSocietyAi(a.societyId)) });
}
