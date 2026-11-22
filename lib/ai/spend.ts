// The platform's AI spend against its caps, and the Sys Admin alert email.
// Server-only.
//
// Platform spend = AI gateway calls on new.vote's key (ai_calls, not 'own')
//                + ScotParl analysis (ai_usage_log)
//                + the News service's spend (its own metrics endpoint).
// Caps: a daily cap (kept in the News service, shared with it) and a monthly
// cap (site_settings 'ai_monthly_cap_usd'). Days and months are UTC.
// When spend reaches 95% of either cap, Sys Admins get one email for that
// day or month (and again if the cap is changed and 95% of it is reached).

import pool from '@/lib/db';
import { claimOnce, getSetting } from '@/lib/siteSettings';
import { sendMemberNotice } from '@/lib/postmark';
import { BASE_URL } from '@/lib/stripe';

export const DEFAULT_MONTHLY_CAP_USD = 30;
export const monthlyCap = () => getSetting<number | null>('ai_monthly_cap_usd', DEFAULT_MONTHLY_CAP_USD);
const ALERT_AT = 0.95;

type News = { reachable: boolean; dailyCap: number | null; today: number; byDay: Map<string, number> };
let newsCache: { at: number; value: News } | null = null;

async function news(): Promise<News> {
  if (newsCache && Date.now() - newsCache.at < 60_000) return newsCache.value;
  let value: News = { reachable: false, dailyCap: null, today: 0, byDay: new Map() };
  const url = process.env.NEWS_API_URL, key = process.env.NEWS_ADMIN_KEY;
  if (url && key) {
    try {
      const r = await fetch(`${url}/v1/admin/metrics/llm?days=31`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000), cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        const byDay = new Map<string, number>();
        for (const u of d.usage ?? []) { const k = String(u.day).slice(0, 10); byDay.set(k, (byDay.get(k) ?? 0) + Number(u.cost_usd ?? 0)); }
        value = { reachable: true, dailyCap: d.daily_budget_usd ?? null, today: Number(d.spent_today_usd ?? 0), byDay };
      }
    } catch { /* unreachable: counted as nothing */ }
  }
  newsCache = { at: Date.now(), value };
  return value;
}

export type SpendSummary = {
  today: number; month: number;
  dailyCap: number | null; monthlyCap: number | null;
  newsReachable: boolean;
  days: { day: string; site: number; news: number; scotparl: number }[];   // this month, oldest first
};

let summaryCache: { at: number; value: SpendSummary } | null = null;

export async function spendSummary(fresh = false): Promise<SpendSummary> {
  if (!fresh && summaryCache && Date.now() - summaryCache.at < 60_000) return summaryCache.value;
  const [n, cap, { rows }] = await Promise.all([
    news(), monthlyCap(),
    pool.query(
      `WITH m AS (SELECT date_trunc('month', now() AT TIME ZONE 'UTC') AS start)
       SELECT to_char(d, 'YYYY-MM-DD') AS day,
              COALESCE((SELECT sum(cost_usd) FROM ai_calls WHERE scope IS DISTINCT FROM 'own'
                        AND (created_at AT TIME ZONE 'UTC') >= d AND (created_at AT TIME ZONE 'UTC') < d + interval '1 day'), 0)::float AS site,
              COALESCE((SELECT sum(cost_micro) FROM ai_usage_log
                        WHERE (created_at AT TIME ZONE 'UTC') >= d AND (created_at AT TIME ZONE 'UTC') < d + interval '1 day'), 0)::float / 1e6 AS scotparl
       FROM m, generate_series(m.start, date_trunc('day', now() AT TIME ZONE 'UTC'), interval '1 day') d ORDER BY d`),
  ]);
  const days = rows.map(r => ({ day: r.day as string, site: r.site as number, scotparl: r.scotparl as number, news: n.byDay.get(r.day) ?? 0 }));
  const todayKey = new Date().toISOString().slice(0, 10);
  const t = days.find(d => d.day === todayKey);
  const today = (t?.site ?? 0) + (t?.scotparl ?? 0) + Math.max(n.today, t?.news ?? 0);
  if (t) t.news = Math.max(n.today, t.news);
  const month = days.reduce((s, d) => s + d.site + d.scotparl + d.news, 0);
  const dailyCap = n.dailyCap ?? Number(process.env.AI_DAILY_BUDGET_USD ?? 1);
  const value = { today, month, dailyCap, monthlyCap: cap, newsReachable: n.reachable, days };
  summaryCache = { at: Date.now(), value };
  return value;
}
export const invalidateSpend = () => { summaryCache = null; newsCache = null; };

/** The platform's spend this month and the monthly cap, for the AI gateway. */
export async function monthStatus(): Promise<{ month: number; cap: number | null }> {
  const s = await spendSummary();
  return { month: s.month, cap: s.monthlyCap };
}

// ── Alerts ───────────────────────────────────────────────────────────────────

async function recipients(): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT lower(email) AS email FROM users
     WHERE is_sys_admin AND email IS NOT NULL AND email <> '' AND user_status IS DISTINCT FROM 'closed'`);
  const to = new Set(rows.map(r => r.email as string));
  to.add((process.env.AI_ALERT_EMAIL ?? process.env.CONTACT_TO_EMAIL ?? 'contact@new.vote').toLowerCase());
  return [...to];
}

const usd = (n: number) => `$${n.toFixed(2)}`;

/**
 * Email Sys Admins when spend reaches 95% of the daily or monthly cap; once
 * per day / month and cap. Returns what was (or, with dryRun, would be) sent.
 */
export async function checkSpendAlerts({ dryRun = false } = {}): Promise<string[]> {
  const s = await spendSummary(true);
  const now = new Date();
  const sent: string[] = [];
  const checks = [
    { which: 'daily', spent: s.today, cap: s.dailyCap, period: now.toISOString().slice(0, 10), resets: 'at midnight (UTC)' },
    { which: 'monthly', spent: s.month, cap: s.monthlyCap, period: now.toISOString().slice(0, 7), resets: 'on the 1st of next month' },
  ];
  for (const c of checks) {
    if (!c.cap || c.cap <= 0 || c.spent < c.cap * ALERT_AT) continue;
    if (dryRun) { sent.push(`${c.which}: would send (${usd(c.spent)} of ${usd(c.cap)})`); continue; }
    if (!(await claimOnce(`ai_alert_${c.which}`, `${c.period}:${c.cap}`))) continue;
    const pct = Math.round((c.spent / c.cap) * 100);
    const subject = `new.vote AI spend: ${pct}% of the ${c.which} cap (${usd(c.spent)} of ${usd(c.cap)})`;
    const text = [
      `The platform's AI spend has reached ${usd(c.spent)} of its ${c.which} cap of ${usd(c.cap)} (${pct}%).`,
      ``,
      `Today: ${usd(s.today)} of ${s.dailyCap != null ? usd(s.dailyCap) : 'no'} daily cap`,
      `This month: ${usd(s.month)} of ${s.monthlyCap != null ? usd(s.monthlyCap) : 'no'} monthly cap`,
      ``,
      `When the cap is reached, platform AI pauses until it resets ${c.resets}: features fall back to their non-AI versions, and Societies using their own AI key are unaffected.`,
      ``,
      `To raise or lower the cap: ${BASE_URL}/admin?tab=ai`,
    ].join('\n');
    for (const to of await recipients()) await sendMemberNotice({ to, subject, text });
    sent.push(`${c.which}: sent`);
  }
  return sent;
}

// After platform AI calls: check at most every 2 minutes per server process
let lastCheck = 0;
export function maybeCheckSpend() {
  if (Date.now() - lastCheck < 120_000) return;
  lastCheck = Date.now();
  void checkSpendAlerts().catch(err => console.error('[ai] spend alert', err));
}
