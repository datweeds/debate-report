import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  // Middleware already verified sysadmin — just fetch data
  try {
    const [
      userCount,
      debateCount,
      statementCount,
      voteCount,
      popularDebates,
      staleDebates,
      debatesByMonth,
    ] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS n FROM users'),
      pool.query("SELECT COUNT(*)::int AS n FROM statements WHERE stat_type = 'resolution'"),
      pool.query("SELECT COUNT(*)::int AS n FROM statements WHERE stat_type != 'resolution'"),
      pool.query('SELECT COUNT(*)::int AS n FROM stat_votes'),

      pool.query(`
        SELECT s.id, s.stat_title,
               COUNT(DISTINCT c.id)::int        AS child_count,
               (s.vote_for + s.vote_against)::int AS votes
        FROM statements s
        LEFT JOIN statements c ON c.resolution_id = s.id
        WHERE s.stat_type = 'resolution'
        GROUP BY s.id, s.stat_title, s.vote_for, s.vote_against
        ORDER BY (COUNT(DISTINCT c.id) + s.vote_for + s.vote_against) DESC
        LIMIT 10
      `),

      pool.query(`
        SELECT id, stat_title, updated_at,
               EXTRACT(DAY FROM NOW() - updated_at)::int AS idle_days
        FROM statements
        WHERE stat_type = 'resolution'
          AND stat_status = 'active'
          AND updated_at < NOW() - INTERVAL '60 days'
        ORDER BY updated_at ASC
        LIMIT 20
      `),

      pool.query(`
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YY') AS month,
               COUNT(*)::int AS count
        FROM statements
        WHERE stat_type = 'resolution'
          AND created_at > NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at)
      `),
    ]);

    return NextResponse.json({
      totals: {
        users:      userCount.rows[0].n,
        debates:    debateCount.rows[0].n,
        statements: statementCount.rows[0].n,
        votes:      voteCount.rows[0].n,
      },
      popularDebates:  popularDebates.rows,
      staleDebates:    staleDebates.rows,
      debatesByMonth:  debatesByMonth.rows,
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
