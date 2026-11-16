import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { listableResolutionSql } from '@/lib/debateAccess';

// GET ?days=N — activity in this Society: totals, and how many are new in
// the last N days (default 7). Debates count only those the viewer may see.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const days = Math.max(1, Math.min(3650, Math.round(Number(req.nextUrl.searchParams.get('days')) || 7)));
  const uid = a.session?.sub ?? null;

  // Each metric: total, and recent (created in the last $3 days). $1 = Society, $2 = viewer
  const { rows: [m] } = await pool.query(`
    WITH since AS (SELECT now() - make_interval(days => $3::int) AS t)
    SELECT
      (SELECT count(*) FROM statements r WHERE r.stat_type = 'resolution' AND r.customer_id = $1 AND r.stat_status <> 'deleted'
         AND ${listableResolutionSql('r', '$2::text')})::int AS debates,
      (SELECT count(*) FROM statements r, since WHERE r.stat_type = 'resolution' AND r.customer_id = $1 AND r.stat_status <> 'deleted'
         AND r.created_at > since.t AND ${listableResolutionSql('r', '$2::text')})::int AS debates_recent,
      (SELECT count(*) FROM statements s JOIN statements r ON r.id = s.resolution_id
        WHERE r.customer_id = $1 AND r.stat_status <> 'deleted' AND s.retracted_at IS NULL
          AND ${listableResolutionSql('r', '$2::text')})::int AS arguments,
      (SELECT count(*) FROM statements s JOIN statements r ON r.id = s.resolution_id, since
        WHERE r.customer_id = $1 AND r.stat_status <> 'deleted' AND s.retracted_at IS NULL AND s.created_at > since.t
          AND ${listableResolutionSql('r', '$2::text')})::int AS arguments_recent,
      (SELECT count(*) FROM society_news_editions WHERE customer_id = $1)::int AS news,
      (SELECT count(*) FROM society_news_editions, since WHERE customer_id = $1 AND created_at > since.t)::int AS news_recent,
      (SELECT count(*) FROM discussion_threads WHERE customer_id = $1 AND deleted_at IS NULL)::int AS threads,
      (SELECT count(*) FROM discussion_threads, since WHERE customer_id = $1 AND deleted_at IS NULL AND created_at > since.t)::int AS threads_recent,
      (SELECT count(*) FROM discussion_posts p JOIN discussion_threads t ON t.id = p.thread_id
        WHERE t.customer_id = $1 AND t.deleted_at IS NULL AND p.deleted_at IS NULL)::int AS posts,
      (SELECT count(*) FROM discussion_posts p JOIN discussion_threads t ON t.id = p.thread_id, since
        WHERE t.customer_id = $1 AND t.deleted_at IS NULL AND p.deleted_at IS NULL AND p.created_at > since.t)::int AS posts_recent,
      (SELECT count(*) FROM society_rtc_log WHERE customer_id = $1 AND action = 'join')::int AS call_joins,
      (SELECT count(*) FROM society_rtc_log, since WHERE customer_id = $1 AND action = 'join' AND created_at > since.t)::int AS call_joins_recent,
      (SELECT count(*) FROM documents WHERE customer_id = $1 AND deleted_at IS NULL)::int AS documents,
      (SELECT count(*) FROM documents, since WHERE customer_id = $1 AND deleted_at IS NULL AND created_at > since.t)::int AS documents_recent,
      (SELECT count(*) FROM society_events WHERE customer_id = $1 AND deleted_at IS NULL)::int AS events,
      (SELECT count(*) FROM society_events, since WHERE customer_id = $1 AND deleted_at IS NULL AND created_at > since.t)::int AS events_recent,
      (SELECT count(*) FROM society_events WHERE customer_id = $1 AND deleted_at IS NULL AND starts_at > now())::int AS events_upcoming,
      (SELECT count(*) FROM projects WHERE customer_id = $1 AND deleted_at IS NULL)::int AS projects,
      (SELECT count(*) FROM projects, since WHERE customer_id = $1 AND deleted_at IS NULL AND created_at > since.t)::int AS projects_recent,
      (SELECT count(*) FROM project_tasks k JOIN projects p ON p.id = k.project_id WHERE p.customer_id = $1 AND p.deleted_at IS NULL)::int AS tasks,
      (SELECT count(*) FROM project_tasks k JOIN projects p ON p.id = k.project_id, since
        WHERE p.customer_id = $1 AND p.deleted_at IS NULL AND k.created_at > since.t)::int AS tasks_recent,
      (SELECT count(*) FROM society_principles sp JOIN society_principle_versions v ON v.id = sp.version_id
        WHERE v.customer_id = $1 AND v.is_current)::int AS principles,
      (SELECT count(*) FROM society_principle_versions, since WHERE customer_id = $1 AND created_at > since.t)::int AS principle_versions_recent,
      (SELECT count(*) FROM customer_members WHERE customer_id = $1)::int AS members,
      (SELECT count(*) FROM customer_members, since WHERE customer_id = $1 AND joined_at > since.t)::int AS members_recent
  `, [a.societyId, uid, days]);

  return NextResponse.json({ days, metrics: m });
}
