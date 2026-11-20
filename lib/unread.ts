// "New since you last looked" counts per Society section. Items a person
// created themselves don't count. A section never opened counts the last 14 days.

import pool from './db';
import { listableResolutionSql } from './debateAccess';

export const SECTIONS = ['debates', 'news', 'discussions', 'documents', 'events', 'projects', 'principles', 'polls'] as const;
export type Section = typeof SECTIONS[number];
export type Counts = Record<Section, number>;

// Since when to count, per Society, for one section ($1 = user, $2 = Society ids)
const since = (section: Section, cid: string) =>
  `COALESCE((SELECT seen_at FROM society_section_seen ss WHERE ss.user_id = $1 AND ss.customer_id = ${cid} AND ss.section = '${section}'),
            now() - interval '14 days')`;

const QUERIES: Record<Section, string> = {
  polls: `
    SELECT p.customer_id AS cid, COUNT(*)::int AS n FROM society_polls p
    WHERE p.customer_id = ANY($2::int[]) AND p.deleted_at IS NULL AND p.status <> 'draft'
      AND p.created_by IS DISTINCT FROM $1 AND p.opened_at > ${since('polls', 'p.customer_id')}
    GROUP BY 1`,
  debates: `
    SELECT r.customer_id AS cid, COUNT(s.id)::int AS n
    FROM statements r JOIN statements s ON s.resolution_id = r.id
    WHERE r.stat_type = 'resolution' AND r.customer_id = ANY($2::int[]) AND r.stat_status <> 'deleted'
      AND s.retracted_at IS NULL AND s.created_by IS DISTINCT FROM $1
      AND s.created_at > ${since('debates', 'r.customer_id')}
      AND ${listableResolutionSql('r', '$1::text')}
    GROUP BY 1`,
  news: `
    SELECT e.customer_id AS cid, COUNT(*)::int AS n FROM society_news_editions e
    WHERE e.customer_id = ANY($2::int[]) AND e.created_at > ${since('news', 'e.customer_id')}
    GROUP BY 1`,
  discussions: `
    SELECT t.customer_id AS cid, COUNT(p.id)::int AS n
    FROM discussion_threads t JOIN discussion_posts p ON p.thread_id = t.id
    WHERE t.customer_id = ANY($2::int[]) AND t.deleted_at IS NULL AND p.deleted_at IS NULL
      AND p.created_by IS DISTINCT FROM $1 AND p.created_at > ${since('discussions', 't.customer_id')}
    GROUP BY 1`,
  documents: `
    SELECT d.customer_id AS cid, COUNT(*)::int AS n FROM documents d
    WHERE d.customer_id = ANY($2::int[]) AND d.deleted_at IS NULL
      AND d.uploaded_by IS DISTINCT FROM $1 AND d.created_at > ${since('documents', 'd.customer_id')}
    GROUP BY 1`,
  events: `
    SELECT e.customer_id AS cid, COUNT(*)::int AS n FROM society_events e
    WHERE e.customer_id = ANY($2::int[]) AND e.deleted_at IS NULL
      AND e.created_by IS DISTINCT FROM $1 AND e.created_at > ${since('events', 'e.customer_id')}
    GROUP BY 1`,
  projects: `
    SELECT cid, SUM(n)::int AS n FROM (
      SELECT p.customer_id AS cid, COUNT(*) AS n FROM project_tasks t JOIN projects p ON p.id = t.project_id
      WHERE p.customer_id = ANY($2::int[]) AND p.deleted_at IS NULL AND t.created_by IS DISTINCT FROM $1
        AND t.created_at > ${since('projects', 'p.customer_id')} GROUP BY 1
      UNION ALL
      SELECT p.customer_id, COUNT(*) FROM project_status_reports r JOIN project_tasks t ON t.id = r.task_id JOIN projects p ON p.id = t.project_id
      WHERE p.customer_id = ANY($2::int[]) AND p.deleted_at IS NULL AND r.user_id IS DISTINCT FROM $1
        AND r.created_at > ${since('projects', 'p.customer_id')} GROUP BY 1
      UNION ALL
      SELECT p.customer_id, COUNT(*) FROM project_raid r JOIN projects p ON p.id = r.project_id
      WHERE p.customer_id = ANY($2::int[]) AND p.deleted_at IS NULL AND r.created_by IS DISTINCT FROM $1
        AND r.created_at > ${since('projects', 'p.customer_id')} GROUP BY 1
    ) x GROUP BY cid`,
  principles: `
    SELECT cid, SUM(n)::int AS n FROM (
      SELECT v.customer_id AS cid, COUNT(*) AS n FROM society_principle_versions v
      WHERE v.customer_id = ANY($2::int[]) AND v.created_by IS DISTINCT FROM $1
        AND v.created_at > ${since('principles', 'v.customer_id')} GROUP BY 1
      UNION ALL
      SELECT r.customer_id, COUNT(*) FROM society_principle_reviews r
      WHERE r.customer_id = ANY($2::int[]) AND r.user_id IS DISTINCT FROM $1
        AND r.created_at > ${since('principles', 'r.customer_id')} GROUP BY 1
    ) x GROUP BY cid`,
};

export async function unreadCounts(userId: string, societyIds: number[]): Promise<Map<number, Counts>> {
  const out = new Map<number, Counts>();
  for (const id of societyIds) out.set(id, Object.fromEntries(SECTIONS.map(s => [s, 0])) as Counts);
  if (!societyIds.length) return out;
  const results = await Promise.all(SECTIONS.map(s => pool.query(QUERIES[s], [userId, societyIds]).then(r => [s, r.rows] as const)));
  for (const [section, rows] of results) for (const r of rows) out.get(r.cid)![section] = r.n;
  // Nothing new in a feature the Society has switched off
  const { rows: off } = await pool.query('SELECT id, disabled_sections FROM customers WHERE id = ANY($1::int[])', [societyIds]);
  for (const r of off) for (const k of r.disabled_sections ?? []) if (k in out.get(r.id)!) out.get(r.id)![k as Section] = 0;
  return out;
}

export async function markSeen(userId: string, societyId: number, section: Section) {
  await pool.query(
    `INSERT INTO society_section_seen (user_id, customer_id, section) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, customer_id, section) DO UPDATE SET seen_at = now()`,
    [userId, societyId, section],
  );
}
