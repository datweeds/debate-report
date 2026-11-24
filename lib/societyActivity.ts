// When anything in a Society was last created or changed (debates, polls, news,
// discussions, documents, events, projects, principles, shared tasks). Only the
// date is shown, never what changed. Members' private tasks don't count. Server-only.
import pool from './db';

const PARTS = [
  `SELECT customer_id AS cid, max(GREATEST(created_at, updated_at)) AS at FROM statements
     WHERE customer_id = ANY($1::int[]) AND stat_status IS DISTINCT FROM 'deleted' GROUP BY 1`,
  `SELECT customer_id, max(GREATEST(created_at, updated_at)) FROM society_polls
     WHERE customer_id = ANY($1::int[]) AND deleted_at IS NULL AND status <> 'draft' GROUP BY 1`,
  `SELECT customer_id, max(created_at) FROM society_news_editions WHERE customer_id = ANY($1::int[]) GROUP BY 1`,
  `SELECT t.customer_id, max(GREATEST(p.created_at, p.edited_at)) FROM discussion_threads t JOIN discussion_posts p ON p.thread_id = t.id
     WHERE t.customer_id = ANY($1::int[]) AND t.deleted_at IS NULL AND p.deleted_at IS NULL GROUP BY 1`,
  `SELECT customer_id, max(GREATEST(created_at, updated_at)) FROM documents WHERE customer_id = ANY($1::int[]) AND deleted_at IS NULL GROUP BY 1`,
  `SELECT customer_id, max(GREATEST(created_at, updated_at)) FROM society_events WHERE customer_id = ANY($1::int[]) AND deleted_at IS NULL GROUP BY 1`,
  `SELECT customer_id, max(GREATEST(created_at, updated_at)) FROM projects WHERE customer_id = ANY($1::int[]) AND deleted_at IS NULL GROUP BY 1`,
  `SELECT p.customer_id, max(GREATEST(t.created_at, t.updated_at)) FROM project_tasks t JOIN projects p ON p.id = t.project_id
     WHERE p.customer_id = ANY($1::int[]) AND p.deleted_at IS NULL GROUP BY 1`,
  `SELECT p.customer_id, max(r.created_at) FROM project_status_reports r JOIN project_tasks t ON t.id = r.task_id JOIN projects p ON p.id = t.project_id
     WHERE p.customer_id = ANY($1::int[]) AND p.deleted_at IS NULL GROUP BY 1`,
  `SELECT p.customer_id, max(GREATEST(r.created_at, r.updated_at)) FROM project_raid r JOIN projects p ON p.id = r.project_id
     WHERE p.customer_id = ANY($1::int[]) AND p.deleted_at IS NULL GROUP BY 1`,
  `SELECT customer_id, max(created_at) FROM society_principle_versions WHERE customer_id = ANY($1::int[]) GROUP BY 1`,
  `SELECT customer_id, max(GREATEST(created_at, updated_at)) FROM society_tasks
     WHERE customer_id = ANY($1::int[]) AND deleted_at IS NULL AND shared_all GROUP BY 1`,
];

/** Society id → when its content last changed (ISO), for Societies with any content. */
export async function lastActivity(ids: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (!ids.length) return out;
  const { rows } = await pool.query(
    `SELECT cid, max(at) AS at FROM (${PARTS.join('\n UNION ALL ')}) x WHERE at IS NOT NULL GROUP BY cid`, [ids]);
  for (const r of rows) out.set(r.cid, new Date(r.at).toISOString());
  return out;
}

/** Members of each Society (members, plus Society Admins who aren't also listed as members). */
export async function memberCounts(ids: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (!ids.length) return out;
  const { rows } = await pool.query(
    `SELECT cid, count(DISTINCT uid)::int AS n FROM (
       SELECT customer_id AS cid, user_id AS uid FROM customer_members WHERE customer_id = ANY($1::int[])
       UNION SELECT tenant_id, user_id FROM customer_roles WHERE tenant_id = ANY($1::int[]) AND role = 'customer_admin') x
     GROUP BY cid`, [ids]);
  for (const r of rows) out.set(r.cid, r.n);
  return out;
}
