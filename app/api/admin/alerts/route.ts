import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// Middleware already verified isSysAdmin — this route is admin-only

export async function GET(req: NextRequest) {
  const url    = new URL(req.url);
  const status = url.searchParams.get('status') ?? 'all'; // all | pending | masked | passed

  try {
    // ── Auto-scanned alerts (content_alerts) ─────────────────────────────────
    const scanWhere = status === 'all'
      ? ''
      : status === 'pending'
      ? `WHERE ca.status = 'pending'`
      : `WHERE ca.status = '${status}'`;

    const { rows: scanRows } = await pool.query(`
      SELECT
        ca.id,
        'auto'                    AS source,
        ca.status,
        ca.created_at,
        ca.reviewed_at,
        ca.content_type,
        ca.flagged_text,
        ca.flags,
        NULL::TEXT                AS reason,
        ca.resolution_id,
        ca.content_id,
        s.stat_title              AS statement_title,
        r.stat_title              AS resolution_title,
        author.user_handle        AS author_handle,
        author.email              AS author_email,
        owner.user_handle         AS owner_handle,
        owner.email               AS owner_email,
        NULL::TEXT                AS flagger_handle,
        NULL::TEXT                AS flagger_email
      FROM content_alerts ca
      LEFT JOIN statements s      ON s.id = ca.content_id
      LEFT JOIN statements r      ON r.id = ca.resolution_id
      LEFT JOIN users author      ON author.id = ca.author_id
      LEFT JOIN debate_forums f   ON f.id = COALESCE(r.forum_id, s.forum_id)
      LEFT JOIN users owner       ON owner.id = f.forum_owner
      ${scanWhere}
      ORDER BY ca.created_at DESC
      LIMIT 200
    `);

    // ── Manual flags (stat_flags) — treated as 'pending' ─────────────────────
    const includeFlagsForStatus = status === 'all' || status === 'pending';
    let flagRows: typeof scanRows = [];

    if (includeFlagsForStatus) {
      const { rows } = await pool.query(`
        SELECT
          sf.id,
          'manual'                  AS source,
          'pending'                 AS status,
          sf.created_at,
          NULL::TIMESTAMPTZ         AS reviewed_at,
          NULL::TEXT                AS content_type,
          NULL::TEXT                AS flagged_text,
          NULL                      AS flags,
          sf.reason,
          s.resolution_id,
          sf.stat_id                AS content_id,
          s.stat_title              AS statement_title,
          r.stat_title              AS resolution_title,
          stmt_author.user_handle   AS author_handle,
          stmt_author.email         AS author_email,
          owner.user_handle         AS owner_handle,
          owner.email               AS owner_email,
          flagger.user_handle       AS flagger_handle,
          flagger.email             AS flagger_email
        FROM stat_flags sf
        LEFT JOIN statements s        ON s.id = sf.stat_id
        LEFT JOIN statements r        ON r.id = s.resolution_id
        LEFT JOIN users stmt_author   ON stmt_author.id = s.created_by
        LEFT JOIN users flagger       ON flagger.id = sf.flagged_by
        LEFT JOIN debate_forums f     ON f.id = COALESCE(r.forum_id, s.forum_id)
        LEFT JOIN users owner         ON owner.id = f.forum_owner
        ORDER BY sf.created_at DESC
        LIMIT 200
      `);
      flagRows = rows;
    }

    const alerts = [...scanRows, ...flagRows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({ alerts, total: alerts.length });

  } catch (err) {
    console.error('[admin/alerts]', err);
    return NextResponse.json({ error: 'Failed to load alerts' }, { status: 500 });
  }
}
