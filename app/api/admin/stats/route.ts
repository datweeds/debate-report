import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { isSealed, openText } from '@/lib/societyCrypto';

// Site analytics for Sys Admin: a tile per metric (all-time total, split into
// parts) and, for its chart, the last 12 months per part.

type Part = { label: string; color: string };
type MetricDef = { key: string; label: string; parts: Part[]; sql: string };   // sql: rows of (at, grp)

const C = { blue: '#3b82f6', amber: '#f59e0b', emerald: '#34d399', violet: '#a78bfa', rose: '#fb7185', sky: '#38bdf8', slate: '#94a3b8' };

const METRICS: MetricDef[] = [
  { key: 'users', label: 'Users', parts: [{ label: 'Users', color: C.blue }],
    sql: `SELECT created_at AS at, 'Users' AS grp FROM users` },
  { key: 'societies', label: 'Societies', parts: [{ label: 'Public', color: C.emerald }, { label: 'Private', color: C.violet }],
    sql: `SELECT created_at AS at, CASE WHEN visibility = 'public' THEN 'Public' ELSE 'Private' END AS grp FROM customers` },
  // AI-assisted: the AI argument generator has been used in the debate
  { key: 'debates', label: 'Debates', parts: [{ label: 'Human', color: C.amber }, { label: 'AI-assisted', color: C.violet }],
    sql: `SELECT s.created_at AS at,
                 CASE WHEN EXISTS (SELECT 1 FROM ai_arg_sessions a WHERE a.resolution_id = s.id) THEN 'AI-assisted' ELSE 'Human' END AS grp
          FROM statements s WHERE s.stat_type = 'resolution' AND s.stat_status <> 'deleted'` },
  { key: 'science', label: 'Science reports', parts: [{ label: 'Science reports', color: C.emerald }],
    sql: `SELECT created_at AS at, 'Science reports' AS grp FROM science_analyses` },
  { key: 'alerts', label: 'Alerts & flags', parts: [{ label: 'Scan alerts', color: C.rose }, { label: 'User flags', color: C.amber }],
    sql: `SELECT created_at AS at, 'Scan alerts' AS grp FROM content_alerts
          UNION ALL SELECT created_at, 'User flags' FROM stat_flags` },
  { key: 'polls', label: 'Polls', parts: [{ label: 'Polls', color: C.sky }],
    sql: `SELECT created_at AS at, 'Polls' AS grp FROM society_polls WHERE deleted_at IS NULL` },
  { key: 'discussions', label: 'Discussions', parts: [{ label: 'Threads', color: C.blue }, { label: 'Messages', color: C.sky }],
    sql: `SELECT created_at AS at, 'Threads' AS grp FROM discussion_threads WHERE deleted_at IS NULL
          UNION ALL SELECT p.created_at, 'Messages' FROM discussion_posts p WHERE p.deleted_at IS NULL` },
  { key: 'documents', label: 'Documents', parts: [{ label: 'Files', color: C.emerald }, { label: 'Links', color: C.slate }],
    sql: `SELECT created_at AS at, CASE WHEN kind = 'link' THEN 'Links' ELSE 'Files' END AS grp FROM documents WHERE deleted_at IS NULL` },
  { key: 'events', label: 'Events', parts: [{ label: 'Events', color: C.amber }],
    sql: `SELECT created_at AS at, 'Events' AS grp FROM society_events WHERE deleted_at IS NULL` },
];

async function metric(m: MetricDef) {
  try {
    const [{ rows: totals }, { rows: monthly }] = await Promise.all([
      pool.query(`SELECT grp, COUNT(*)::int AS n FROM (${m.sql}) x GROUP BY grp`),
      // Every one of the last 12 months, including empty ones
      pool.query(`
        WITH months AS (SELECT generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') AS m)
        SELECT to_char(months.m, 'Mon YY') AS month, months.m AS m, x.grp, COUNT(x.at)::int AS n
        FROM months LEFT JOIN (${m.sql}) x ON date_trunc('month', x.at) = months.m
        GROUP BY months.m, x.grp ORDER BY months.m`),
    ]);
    const monthList = [...new Map(monthly.map(r => [r.month as string, r.m])).keys()];
    const count = (grp: string, month: string) => monthly.find(r => r.grp === grp && r.month === month)?.n ?? 0;
    const parts = m.parts.map(p => ({ ...p, value: totals.find(t => t.grp === p.label)?.n ?? 0 }));
    return {
      key: m.key, label: m.label,
      total: parts.reduce((a, p) => a + p.value, 0),
      parts,
      series: m.parts.map(p => ({ ...p, data: monthList.map(month => ({ month, count: count(p.label, month) })) })),
    };
  } catch (err) {
    console.error(`[admin stats:${m.key}]`, err);
    return { key: m.key, label: m.label, total: 0, parts: [], series: [], error: true };
  }
}

export async function GET() {
  // Middleware already verified sysadmin
  try {
    const session = await getSession();
    const [metrics, popularDebates, staleDebates, grants] = await Promise.all([
      Promise.all(METRICS.map(metric)),
      pool.query(`
        SELECT s.id, s.stat_title, s.customer_id, c.name AS society,
               COUNT(DISTINCT ch.id)::int         AS child_count,
               (s.vote_for + s.vote_against)::int AS votes
        FROM statements s
        LEFT JOIN statements ch ON ch.resolution_id = s.id
        LEFT JOIN customers c ON c.id = s.customer_id
        WHERE s.stat_type = 'resolution' AND s.stat_status <> 'deleted'
        GROUP BY s.id, s.stat_title, s.customer_id, c.name, s.vote_for, s.vote_against
        ORDER BY (COUNT(DISTINCT ch.id) + s.vote_for + s.vote_against) DESC
        LIMIT 10
      `),
      pool.query(`
        SELECT s.id, s.stat_title, s.customer_id, c.name AS society, s.updated_at,
               EXTRACT(DAY FROM NOW() - s.updated_at)::int AS idle_days
        FROM statements s LEFT JOIN customers c ON c.id = s.customer_id
        WHERE s.stat_type = 'resolution'
          AND s.stat_status = 'active'
          AND s.updated_at < NOW() - INTERVAL '60 days'
        ORDER BY s.updated_at ASC
        LIMIT 20
      `),
      session ? pool.query(
        `SELECT DISTINCT customer_id FROM sysadmin_access WHERE user_id = $1 AND ended_at IS NULL AND expires_at > now()`, [session.sub])
        : Promise.resolve({ rows: [] }),
    ]);

    // Private debates' titles are encrypted: show them only with a break-glass
    // grant for their Society, otherwise say whose they are.
    const granted = new Set(grants.rows.map(r => r.customer_id as number));
    const title = async (r: { stat_title: string; customer_id: number | null; society: string | null }) => {
      if (r.stat_title?.startsWith('sn1:')) return '🔐 Sealed debate';
      if (!isSealed(r.stat_title)) return r.stat_title;
      if (r.customer_id != null && granted.has(r.customer_id)) return openText(r.customer_id, r.stat_title);
      return `🔒 Private debate${r.society ? ` · ${r.society}` : ''}`;
    };
    for (const r of [...popularDebates.rows, ...staleDebates.rows]) r.stat_title = await title(r);

    return NextResponse.json({
      metrics,
      popularDebates: popularDebates.rows.map(({ id, stat_title, child_count, votes }) => ({ id, stat_title, child_count, votes })),
      staleDebates:   staleDebates.rows.map(({ id, stat_title, idle_days }) => ({ id, stat_title, idle_days })),
      server: {
        uptimeSeconds: Math.floor(process.uptime()),
        memoryMB:      Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}
