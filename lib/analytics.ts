// Site analytics, for the whole site (Sys Admin) or for a set of Societies
// (Society Admins: only those they administer). Server-only.
//
// Each metric is a tile (all-time total, split into parts) with a chart of the
// last 12 months per part. Plus: AI usage with estimated cost, the most active
// Societies, and the most active / stale debates.

import fs from 'fs';
import os from 'os';
import path from 'path';
import pool from './db';
import { isSealed, openText } from './societyCrypto';
import { newsConfigured, newsFetch } from './news';

type Part = { label: string; color: string };
// sql returns rows of (at, grp, cid): when, which part, and which Society (or null)
type MetricDef = { key: string; label: string; parts: Part[]; sql: string; scoped?: Omit<MetricDef, 'key' | 'scoped'> };
export type Scope = number[] | null;   // null: the whole site

const C = { blue: '#3b82f6', amber: '#f59e0b', emerald: '#34d399', violet: '#a78bfa', rose: '#fb7185', sky: '#38bdf8', slate: '#94a3b8' };
const RES = (s: string) => `COALESCE((SELECT r.customer_id FROM statements r WHERE r.id = ${s}.resolution_id), ${s}.customer_id)`;

const METRICS: MetricDef[] = [
  { key: 'users', label: 'Users', parts: [{ label: 'Users', color: C.blue }],
    sql: `SELECT created_at AS at, 'Users' AS grp, NULL::int AS cid FROM users`,
    // For a Society Admin: people joining their Societies
    scoped: { label: 'Members', parts: [{ label: 'Members', color: C.blue }],
      sql: `SELECT joined_at AS at, 'Members' AS grp, customer_id AS cid FROM customer_members` } },
  { key: 'societies', label: 'Societies', parts: [{ label: 'Public', color: C.emerald }, { label: 'Private', color: C.violet }],
    sql: `SELECT created_at AS at, CASE WHEN visibility = 'public' THEN 'Public' ELSE 'Private' END AS grp, id AS cid FROM customers` },
  // AI-assisted: the AI argument generator has been used in the debate
  { key: 'debates', label: 'Debates', parts: [{ label: 'Human', color: C.amber }, { label: 'AI-assisted', color: C.violet }],
    sql: `SELECT s.created_at AS at,
                 CASE WHEN EXISTS (SELECT 1 FROM ai_arg_sessions a WHERE a.resolution_id = s.id) THEN 'AI-assisted' ELSE 'Human' END AS grp, s.customer_id AS cid
          FROM statements s WHERE s.stat_type = 'resolution' AND s.stat_status <> 'deleted'` },
  { key: 'science', label: 'Science reports', parts: [{ label: 'Science reports', color: C.emerald }],
    sql: `SELECT a.created_at AS at, 'Science reports' AS grp, ${RES('s')} AS cid FROM science_analyses a JOIN statements s ON s.id = a.statement_id` },
  { key: 'alerts', label: 'Alerts & flags', parts: [{ label: 'Scan alerts', color: C.rose }, { label: 'User flags', color: C.amber }],
    sql: `SELECT created_at AS at, 'Scan alerts' AS grp, customer_id AS cid FROM content_alerts
          UNION ALL SELECT f.created_at, 'User flags', ${RES('s')} FROM stat_flags f JOIN statements s ON s.id = f.stat_id` },
  { key: 'polls', label: 'Polls', parts: [{ label: 'Polls', color: C.sky }],
    sql: `SELECT created_at AS at, 'Polls' AS grp, customer_id AS cid FROM society_polls WHERE deleted_at IS NULL` },
  { key: 'discussions', label: 'Discussions', parts: [{ label: 'Threads', color: C.blue }, { label: 'Messages', color: C.sky }],
    sql: `SELECT created_at AS at, 'Threads' AS grp, customer_id AS cid FROM discussion_threads WHERE deleted_at IS NULL
          UNION ALL SELECT p.created_at, 'Messages', t.customer_id FROM discussion_posts p JOIN discussion_threads t ON t.id = p.thread_id WHERE p.deleted_at IS NULL` },
  { key: 'documents', label: 'Documents', parts: [{ label: 'Files', color: C.emerald }, { label: 'Links', color: C.slate }],
    sql: `SELECT created_at AS at, CASE WHEN kind = 'link' THEN 'Links' ELSE 'Files' END AS grp, customer_id AS cid FROM documents WHERE deleted_at IS NULL` },
  { key: 'events', label: 'Events', parts: [{ label: 'Events', color: C.amber }],
    sql: `SELECT created_at AS at, 'Events' AS grp, customer_id AS cid FROM society_events WHERE deleted_at IS NULL` },
  // Counts only (task text is private). A personal task converted to a project
  // task is soft-deleted, so it's counted once, as the project task.
  { key: 'tasks', label: 'Tasks', parts: [{ label: 'Project tasks', color: C.amber }, { label: 'Personal tasks', color: C.violet }],
    sql: `SELECT k.created_at AS at, 'Project tasks' AS grp, p.customer_id AS cid FROM project_tasks k JOIN projects p ON p.id = k.project_id AND p.deleted_at IS NULL
          UNION ALL SELECT created_at, 'Personal tasks', customer_id FROM society_tasks WHERE deleted_at IS NULL` },
];

const inScope = (sql: string) => `SELECT * FROM (${sql}) y WHERE $1::int[] IS NULL OR y.cid = ANY($1::int[])`;

async function metric(def: MetricDef, scope: Scope) {
  const m = scope && def.scoped ? { ...def, ...def.scoped } : def;
  try {
    const src = inScope(m.sql);
    const [{ rows: totals }, { rows: monthly }] = await Promise.all([
      pool.query(`SELECT grp, COUNT(*)::int AS n FROM (${src}) x GROUP BY grp`, [scope]),
      // Every one of the last 12 months, including empty ones
      pool.query(`
        WITH months AS (SELECT generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') AS m)
        SELECT to_char(months.m, 'Mon YY') AS month, months.m AS m, x.grp, COUNT(x.at)::int AS n
        FROM months LEFT JOIN (${src}) x ON date_trunc('month', x.at) = months.m
        GROUP BY months.m, x.grp ORDER BY months.m`, [scope]),
    ]);
    const monthList = [...new Map(monthly.map(r => [r.month as string, r.m])).keys()];
    const count = (grp: string, month: string) => monthly.find(r => r.grp === grp && r.month === month)?.n ?? 0;
    const parts = m.parts.map(p => ({ ...p, value: totals.find(t => t.grp === p.label)?.n ?? 0 }));
    return {
      key: m.key ?? def.key, label: m.label, total: parts.reduce((a, p) => a + p.value, 0), parts,
      series: m.parts.map(p => ({ ...p, data: monthList.map(month => ({ month, count: count(p.label, month) })) })),
    };
  } catch (err) {
    console.error(`[analytics:${def.key}]`, err);
    return { key: def.key, label: m.label, total: 0, parts: [], series: [], error: true };
  }
}

// ── AI usage: estimated cost to new.vote, by source ─────────────────────────
// ai_calls: the AI gateway (Society AI features, debate tools, quality). Calls
//   on a Society's own key (scope 'own') are paid by that Society: shown, not totalled.
// ai_usage_log: ScotParl analyses (cost_micro = millionths of a dollar).
// News: the News service's own LLM spend, per Society subscription (last 365 days only).
// Science reports come from thescience.app, which reports no cost.
const USD_TO_GBP = Number(process.env.USD_TO_GBP) || 0.79;
const AI_PARTS = [
  { label: 'AI gateway', color: C.violet },
  { label: 'ScotParl analysis', color: C.sky },
  { label: 'News', color: C.amber },
];
type AiRow = { source: string; calls: number | null; tokensIn: number; tokensOut: number; usd: number; monthUsd: number; note?: string };

async function aiUsage(scope: Scope) {
  const monthKeys = (await pool.query(
    `SELECT to_char(m, 'Mon YY') AS month, to_char(m, 'YYYY-MM') AS ym
     FROM generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') m ORDER BY m`)).rows as { month: string; ym: string }[];
  const thisYm = monthKeys[monthKeys.length - 1].ym;
  const byMonth = new Map<string, Map<string, number>>(AI_PARTS.map(p => [p.label, new Map()]));
  const add = (src: string, ym: string, usd: number) => { const m = byMonth.get(src)!; m.set(ym, (m.get(ym) ?? 0) + usd); };
  const rows: AiRow[] = [];
  const notes: string[] = [];

  const [gw, own, sp, sci] = await Promise.all([
    pool.query(`SELECT to_char(created_at, 'YYYY-MM') AS ym, count(*)::int AS calls, COALESCE(sum(tokens_in), 0)::bigint AS ti,
                       COALESCE(sum(tokens_out), 0)::bigint AS tout, COALESCE(sum(cost_usd), 0)::float AS usd
                FROM ai_calls WHERE scope IS DISTINCT FROM 'own' AND ($1::int[] IS NULL OR customer_id = ANY($1::int[])) GROUP BY 1`, [scope]),
    pool.query(`SELECT count(*)::int AS calls, COALESCE(sum(tokens_in), 0)::bigint AS ti, COALESCE(sum(tokens_out), 0)::bigint AS tout,
                       COALESCE(sum(cost_usd), 0)::float AS usd,
                       COALESCE(sum(cost_usd) FILTER (WHERE date_trunc('month', created_at) = date_trunc('month', now())), 0)::float AS month
                FROM ai_calls WHERE scope = 'own' AND ($1::int[] IS NULL OR customer_id = ANY($1::int[]))`, [scope]),
    pool.query(`SELECT to_char(created_at, 'YYYY-MM') AS ym, count(*)::int AS calls, COALESCE(sum(input_tokens), 0)::bigint AS ti,
                       COALESCE(sum(output_tokens), 0)::bigint AS tout, COALESCE(sum(cost_micro), 0)::float / 1e6 AS usd
                FROM ai_usage_log WHERE $1::int[] IS NULL OR tenant_id = ANY($1::int[]) GROUP BY 1`, [scope]),
    pool.query(`SELECT count(*)::int AS n FROM science_analyses a JOIN statements s ON s.id = a.statement_id
                WHERE $1::int[] IS NULL OR ${RES('s')} = ANY($1::int[])`, [scope]),
  ]);
  for (const [src, q] of [['AI gateway', gw], ['ScotParl analysis', sp]] as const) {
    let calls = 0, ti = 0, tout = 0, usd = 0, month = 0;
    for (const r of q.rows) {
      calls += r.calls; ti += Number(r.ti); tout += Number(r.tout); usd += r.usd;
      if (r.ym === thisYm) month += r.usd;
      add(src, r.ym, r.usd);
    }
    rows.push({ source: src, calls, tokensIn: ti, tokensOut: tout, usd, monthUsd: month });
  }

  // News: each Society's subscription reports its own LLM spend
  let newsOwn = 0;
  if (newsConfigured()) {
    const subs = (await pool.query(
      'SELECT subscription_id FROM society_news WHERE subscription_id IS NOT NULL AND ($1::int[] IS NULL OR customer_id = ANY($1::int[]))', [scope])).rows;
    let ti = 0, tout = 0, usd = 0, month = 0, failed = 0;
    await Promise.all(subs.map(async s => {
      try {
        const u = await newsFetch<{ days: { day: string; scope: string; tokens_in: number; tokens_out: number; cost_usd: number }[] }>(
          `/v1/subscriptions/${s.subscription_id}/usage?days=365`);
        for (const d of u.days ?? []) {
          if (d.scope === 'own') { newsOwn += d.cost_usd; continue; }
          const ym = String(d.day).slice(0, 7);
          ti += d.tokens_in; tout += d.tokens_out; usd += d.cost_usd;
          if (ym === thisYm) month += d.cost_usd;
          add('News', ym, d.cost_usd);
        }
      } catch { failed++; }
    }));
    rows.push({ source: 'News', calls: null, tokensIn: ti, tokensOut: tout, usd, monthUsd: month,
      note: `last 365 days${failed ? `; ${failed} of ${subs.length} Societies’ News couldn’t be read` : ''}` });
  } else {
    rows.push({ source: 'News', calls: null, tokensIn: 0, tokensOut: 0, usd: 0, monthUsd: 0, note: 'News service not configured' });
  }
  const o = own.rows[0];
  rows.push({ source: 'Societies’ own AI keys', calls: o.calls, tokensIn: Number(o.ti), tokensOut: Number(o.tout), usd: o.usd + newsOwn, monthUsd: o.month,
    note: 'paid by those Societies: not in the total' });
  if (sci.rows[0].n) notes.push(`${sci.rows[0].n} science report${sci.rows[0].n === 1 ? '' : 's'} came from thescience.app, which doesn’t report a cost.`);
  notes.push(`£ at about £${USD_TO_GBP.toFixed(2)} per $1${scope ? '' : ' (set USD_TO_GBP on the server to change it)'}.`);

  const ours = rows.filter(r => AI_PARTS.some(p => p.label === r.source));
  const total = ours.reduce((a, r) => a + r.usd, 0);
  return {
    key: 'ai', label: 'AI usage', unit: 'usd' as const,
    total: Math.round(total * 100) / 100,
    parts: AI_PARTS.map(p => ({ ...p, value: Math.round((ours.find(r => r.source === p.label)?.usd ?? 0) * 100) / 100 })),
    series: AI_PARTS.map(p => ({ ...p, data: monthKeys.map(k => ({ month: k.month, count: Math.round((byMonth.get(p.label)!.get(k.ym) ?? 0) * 100) / 100 })) })),
    ai: { gbpRate: USD_TO_GBP, monthUsd: ours.reduce((a, r) => a + r.monthUsd, 0), rows, notes },
  };
}

// ── Most active Societies: things members did, by area ──────────────────────
const AREAS = [
  { label: 'Discussions', color: C.blue }, { label: 'Debate', color: C.amber }, { label: 'Events', color: C.emerald },
  { label: 'Documents', color: C.slate }, { label: 'Polls', color: C.sky }, { label: 'Projects & tasks', color: C.violet },
];
const ACTIVITY_SQL = `
  SELECT customer_id AS cid, 'Discussions' AS area, created_at AS at FROM discussion_threads WHERE deleted_at IS NULL
  UNION ALL SELECT t.customer_id, 'Discussions', p.created_at FROM discussion_posts p JOIN discussion_threads t ON t.id = p.thread_id WHERE p.deleted_at IS NULL
  UNION ALL SELECT ${RES('s')}, 'Debate', s.created_at FROM statements s
  UNION ALL SELECT ${RES('s')}, 'Debate', v.created_at FROM stat_votes v JOIN statements s ON s.id = v.statement_id
  UNION ALL SELECT ${RES('s')}, 'Debate', cm.created_at FROM comments cm JOIN statements s ON s.id = cm.statement_id
  UNION ALL SELECT customer_id, 'Events', created_at FROM society_events WHERE deleted_at IS NULL
  UNION ALL SELECT e.customer_id, 'Events', er.updated_at FROM event_responses er JOIN society_events e ON e.id = er.event_id
  UNION ALL SELECT customer_id, 'Documents', created_at FROM documents WHERE deleted_at IS NULL
  UNION ALL SELECT customer_id, 'Polls', created_at FROM society_polls WHERE deleted_at IS NULL
  UNION ALL SELECT p.customer_id, 'Polls', pp.voted_at FROM poll_participants pp JOIN society_polls p ON p.id = pp.poll_id
  UNION ALL SELECT pr.customer_id, 'Projects & tasks', k.created_at FROM project_tasks k JOIN projects pr ON pr.id = k.project_id
  UNION ALL SELECT pr.customer_id, 'Projects & tasks', sr.created_at FROM project_status_reports sr JOIN project_tasks k ON k.id = sr.task_id JOIN projects pr ON pr.id = k.project_id
  UNION ALL SELECT customer_id, 'Projects & tasks', created_at FROM society_tasks`;
const WINDOWS = [{ key: 'd30', days: 30 }, { key: 'd90', days: 90 }, { key: 'd365', days: 365 }] as const;

async function activeSocieties(scope: Scope, me: string | null) {
  const { rows } = await pool.query(
    `SELECT cid, area, count(*) FILTER (WHERE at > now() - interval '30 days')::int AS d30,
            count(*) FILTER (WHERE at > now() - interval '90 days')::int AS d90,
            count(*) FILTER (WHERE at > now() - interval '365 days')::int AS d365
     FROM (${ACTIVITY_SQL}) a WHERE cid IS NOT NULL AND at IS NOT NULL AND ($1::int[] IS NULL OR cid = ANY($1::int[])) GROUP BY cid, area`, [scope]);
  const top: Record<string, { id: number; total: number; byArea: Record<string, number> }[]> = {};
  const ids = new Set<number>();
  for (const w of WINDOWS) {
    const per = new Map<number, Record<string, number>>();
    for (const r of rows) { if (!r[w.key]) continue; const m = per.get(r.cid) ?? {}; m[r.area] = r[w.key]; per.set(r.cid, m); }
    top[w.key] = [...per].map(([id, byArea]) => ({ id, byArea, total: Object.values(byArea).reduce((a, n) => a + n, 0) }))
      .sort((a, b) => b.total - a.total).slice(0, 10);
    for (const t of top[w.key]) ids.add(t.id);
  }
  // Names: public Societies, and private ones you belong to. The Sys Admin
  // view also gets a way to email each Society's moderators.
  const { rows: socs } = ids.size ? await pool.query(
    `SELECT c.id, c.name, c.visibility, c.status, c.subdomain, c.contact_email,
            ($2::text IS NOT NULL AND (EXISTS (SELECT 1 FROM customer_members m WHERE m.customer_id = c.id AND m.user_id = $2::text)
              OR EXISTS (SELECT 1 FROM customer_roles r WHERE r.tenant_id = c.id AND r.user_id = $2::text))) AS mine,
            COALESCE((SELECT array_agg(DISTINCT u.email) FROM customer_roles r JOIN users u ON u.id::text = r.user_id
                      WHERE r.tenant_id = c.id AND r.role = 'customer_admin' AND u.email IS NOT NULL), '{}') AS admins
     FROM customers c WHERE c.id = ANY($1::int[])`, [[...ids], me]) : { rows: [] };
  const info = Object.fromEntries(socs.map(s => {
    const named = s.visibility === 'public' || s.mine;
    const emails = scope ? [] : [...new Set([...(s.admins as string[]), ...(s.contact_email ? [s.contact_email] : [])])];
    return [s.id, {
      id: s.id, name: named ? s.name : `Private Society #${s.id}`, private: s.visibility !== 'public', named,
      closed: s.status === 'closed', href: named ? `/society/${s.subdomain || s.id}` : null, emails,
    }];
  }));
  return { areas: AREAS, contact: !scope, windows: Object.fromEntries(WINDOWS.map(w => [w.key, top[w.key].filter(t => info[t.id]).map(t => ({ ...info[t.id], total: t.total, byArea: t.byArea }))])) };
}

// The nightly backup's last result (written by ~/bin/nv-backup.sh)
function backupStatus(file = 'status.json'): { ok: boolean; at: string; message: string; bytes: number; warnings: string[] } | null {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config', 'backup', file), 'utf8'));
    return { ...s, bytes: s.bytes ?? s.bytes_added ?? 0 };
  } catch { return null; }
}

// ── Everything, for one viewer ───────────────────────────────────────────────
export async function buildAnalytics({ scope, me, sysAdmin }: { scope: Scope; me: string | null; sysAdmin: boolean }) {
  const [metrics, ai, active, popularDebates, staleDebates, grants] = await Promise.all([
    Promise.all(METRICS.map(m => metric(m, scope))),
    aiUsage(scope).catch(err => { console.error('[analytics:ai]', err); return { key: 'ai', label: 'AI usage', unit: 'usd' as const, total: 0, parts: [], series: [], error: true }; }),
    activeSocieties(scope, me).catch(err => { console.error('[analytics:active]', err); return null; }),
    pool.query(`
      SELECT s.id, s.stat_title, s.customer_id, c.name AS society,
             COUNT(DISTINCT ch.id)::int AS child_count, (s.vote_for + s.vote_against)::int AS votes
      FROM statements s LEFT JOIN statements ch ON ch.resolution_id = s.id LEFT JOIN customers c ON c.id = s.customer_id
      WHERE s.stat_type = 'resolution' AND s.stat_status <> 'deleted' AND ($1::int[] IS NULL OR s.customer_id = ANY($1::int[]))
      GROUP BY s.id, s.stat_title, s.customer_id, c.name, s.vote_for, s.vote_against
      ORDER BY (COUNT(DISTINCT ch.id) + s.vote_for + s.vote_against) DESC LIMIT 10`, [scope]),
    pool.query(`
      SELECT s.id, s.stat_title, s.customer_id, c.name AS society, EXTRACT(DAY FROM NOW() - s.updated_at)::int AS idle_days
      FROM statements s LEFT JOIN customers c ON c.id = s.customer_id
      WHERE s.stat_type = 'resolution' AND s.stat_status = 'active' AND s.updated_at < NOW() - INTERVAL '60 days'
        AND ($1::int[] IS NULL OR s.customer_id = ANY($1::int[]))
      ORDER BY s.updated_at ASC LIMIT 20`, [scope]),
    sysAdmin && me ? pool.query(
      `SELECT DISTINCT customer_id FROM sysadmin_access WHERE user_id = $1 AND ended_at IS NULL AND expires_at > now()`, [me])
      : Promise.resolve({ rows: [] as { customer_id: number }[] }),
  ]);

  // Private debates' titles are encrypted. A Society Admin reads their own
  // Societies'; Sys Admin only with a break-glass grant, otherwise whose they are.
  const granted = new Set([...grants.rows.map(r => r.customer_id as number), ...(scope ?? [])]);
  const title = async (r: { stat_title: string; customer_id: number | null; society: string | null }) => {
    if (r.stat_title?.startsWith('sn1:')) return '🔐 Sealed debate';
    if (!isSealed(r.stat_title)) return r.stat_title;
    if (r.customer_id != null && granted.has(r.customer_id)) return openText(r.customer_id, r.stat_title);
    return `🔒 Private debate${r.society ? ` · ${r.society}` : ''}`;
  };
  for (const r of [...popularDebates.rows, ...staleDebates.rows]) r.stat_title = await title(r);

  return {
    metrics: [...metrics, ai],
    activeSocieties: active,
    popularDebates: popularDebates.rows.map(({ id, stat_title, child_count, votes }) => ({ id, stat_title, child_count, votes })),
    staleDebates: staleDebates.rows.map(({ id, stat_title, idle_days }) => ({ id, stat_title, idle_days })),
    ...(scope ? {} : { server: { uptimeSeconds: Math.floor(process.uptime()), memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024), backup: backupStatus(), incremental: backupStatus('restic-status.json'), dependencies: backupStatus('deps-status.json') } }),
  };
}
