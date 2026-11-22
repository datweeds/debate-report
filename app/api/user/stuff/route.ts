import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { hideEndToEnd, openDeep } from '@/lib/societyCrypto';

// My Stuff: one flat list of everything the signed-in member has done, across
// every Society they're in. Each item has a type, the member's role in it
// (Started, Voted, Attending…), its Society and a link. The page filters,
// searches and sorts it.
//
// Each query returns: id, role, title, sub, optional pre (a plain label put
// before sub once it's decrypted — never join encrypted text in SQL), cid, society, slug, l1, l2 (link
// parts), at. $1 = the user. Only Societies the member still belongs to (or
// moderates), public ones, and debates outside any Society; never closed ones.

const IN_SOCIETY = `(c.id IS NULL OR (c.status IS DISTINCT FROM 'closed' AND (c.is_public
  OR EXISTS (SELECT 1 FROM customer_members m WHERE m.customer_id = c.id AND m.user_id = $1::text)
  OR EXISTS (SELECT 1 FROM customer_roles cr WHERE cr.tenant_id = c.id AND cr.user_id = $1::text))))`;
const LIMIT = 1000;   // per query, newest first

type Cat = { name: string; color: string };
type Row = { cats?: Cat[] | null; pstatus?: string | null; id: string; role: string; title: string | null; pre?: string | null; sub: string | null; cid: number | null; society: string | null; slug: string | null; l1: string | null; l2: string | null; at: string };
type Q = { type: string; sql: string; href: (r: Row, soc: string) => string };

const day = (col: string) => `to_char(${col} AT TIME ZONE 'Europe/London', 'DD Mon YYYY')`;
// A request's or invitation's decision, as the person who sent it reads it
const DECISION = (col: string) => `CASE ${col} WHEN 'pending' THEN 'Awaiting a decision' WHEN 'approved' THEN 'Approved' WHEN 'accepted' THEN 'Accepted'
  WHEN 'declined' THEN 'Declined' WHEN 'denied' THEN 'Rejected' WHEN 'rejected' THEN 'Rejected' ELSE initcap(${col}) END`;

const QUERIES: Q[] = [
  // ── Discussions: threads you started (with their opening message) and your other messages
  { type: 'discussions', href: (r, s) => `${s}/discussions/${r.l1}`,
    sql: `SELECT t.id::text AS id, 'Started' AS role, t.title, (SELECT p0.body FROM discussion_posts p0 WHERE p0.thread_id = t.id AND p0.deleted_at IS NULL ORDER BY p0.created_at, p0.id LIMIT 1) AS sub,
                 c.id AS cid, c.name AS society, c.subdomain AS slug, t.id::text AS l1, NULL AS l2, t.created_at AS at
          FROM discussion_threads t JOIN customers c ON c.id = t.customer_id
          WHERE t.created_by = $1 AND t.deleted_at IS NULL AND ${IN_SOCIETY}` },
  { type: 'discussions', href: (r, s) => `${s}/discussions/${r.l1}`,
    sql: `SELECT p.id::text AS id, 'Posted' AS role, t.title, p.body AS sub, c.id AS cid, c.name AS society, c.subdomain AS slug, t.id::text AS l1, NULL AS l2, p.created_at AS at
          FROM discussion_posts p JOIN discussion_threads t ON t.id = p.thread_id AND t.deleted_at IS NULL JOIN customers c ON c.id = t.customer_id
          WHERE p.created_by = $1 AND p.deleted_at IS NULL AND ${IN_SOCIETY}
            AND NOT (t.created_by = $1 AND p.id = (SELECT p0.id FROM discussion_posts p0 WHERE p0.thread_id = t.id ORDER BY p0.created_at, p0.id LIMIT 1))` },
  // ── Events: added, or responded to
  { type: 'events', href: (r, s) => `${s}/events?event=${r.l1}`,
    sql: `SELECT e.id::text AS id, 'Created' AS role, e.title, ${day('e.starts_at')} AS sub, c.id AS cid, c.name AS society, c.subdomain AS slug, e.id::text AS l1, NULL AS l2, e.created_at AS at
          FROM society_events e JOIN customers c ON c.id = e.customer_id
          WHERE e.created_by = $1 AND e.deleted_at IS NULL AND ${IN_SOCIETY}` },
  { type: 'events', href: (r, s) => `${s}/events?event=${r.l1}`,
    sql: `SELECT e.id::text || ':r' AS id, CASE er.response WHEN 'going' THEN 'Attending' ELSE 'Not coming' END AS role, e.title, ${day('e.starts_at')} AS sub,
                 c.id AS cid, c.name AS society, c.subdomain AS slug, e.id::text AS l1, NULL AS l2, er.updated_at AS at
          FROM event_responses er JOIN society_events e ON e.id = er.event_id AND e.deleted_at IS NULL JOIN customers c ON c.id = e.customer_id
          WHERE er.user_id = $1 AND ${IN_SOCIETY}` },
  // ── Documents: added, or shared by link
  { type: 'documents', href: (r, s) => `${s}/documents?${r.l2 === 'note' ? 'note' : 'doc'}=${r.l1}`,
    sql: `SELECT d.id::text AS id, 'Added' AS role, d.title, CASE d.kind WHEN 'link' THEN 'Link' WHEN 'note' THEN 'Note' ELSE 'File' END AS pre, d.description AS sub,
                 c.id AS cid, c.name AS society, c.subdomain AS slug, d.id::text AS l1, d.kind AS l2, d.created_at AS at
          FROM documents d JOIN customers c ON c.id = d.customer_id
          WHERE d.uploaded_by = $1 AND d.deleted_at IS NULL AND ${IN_SOCIETY}` },
  { type: 'documents', href: (r, s) => `${s}/documents?${r.l2 === 'note' ? 'note' : 'doc'}=${r.l1}`,
    sql: `SELECT sh.id::text AS id, 'Shared' AS role, d.title,
                 'Share link · ' || CASE WHEN sh.revoked_at IS NOT NULL THEN 'revoked' WHEN sh.expires_at < now() THEN 'expired' ELSE 'until ' || ${day('sh.expires_at')} END AS sub,
                 c.id AS cid, c.name AS society, c.subdomain AS slug, d.id::text AS l1, d.kind AS l2, sh.created_at AS at
          FROM document_shares sh JOIN documents d ON d.id = sh.document_id AND d.deleted_at IS NULL JOIN customers c ON c.id = d.customer_id
          WHERE sh.created_by = $1 AND ${IN_SOCIETY}` },
  // ── Polls: created, or voted in (a poll's title is inside its payload)
  { type: 'polls', href: (r, s) => `${s}/polls/${r.l1}`,
    sql: `SELECT p.id::text AS id, 'Created' AS role, p.payload AS title, initcap(p.status) || ' · ' || p.vote_count || ' voted' AS sub,
                 c.id AS cid, c.name AS society, c.subdomain AS slug, p.id::text AS l1, NULL AS l2, p.created_at AS at
          FROM society_polls p JOIN customers c ON c.id = p.customer_id
          WHERE p.created_by = $1 AND p.deleted_at IS NULL AND ${IN_SOCIETY}` },
  { type: 'polls', href: (r, s) => `${s}/polls/${r.l1}`,
    sql: `SELECT p.id::text || ':v' AS id, 'Voted' AS role, p.payload AS title, initcap(p.status) AS sub,
                 c.id AS cid, c.name AS society, c.subdomain AS slug, p.id::text AS l1, NULL AS l2, pp.voted_at AS at
          FROM poll_participants pp JOIN society_polls p ON p.id = pp.poll_id AND p.deleted_at IS NULL JOIN customers c ON c.id = p.customer_id
          WHERE pp.user_id = $1 AND pp.voted_at IS NOT NULL AND ${IN_SOCIETY}` },
  // ── Debate: statements you wrote, and your votes
  { type: 'debate', href: r => `/chamber?resolution=${r.l1}${r.l2 ? `&statement=${r.l2}` : ''}`,
    sql: `SELECT s.id::text AS id, CASE WHEN s.stat_type = 'resolution' THEN 'Started' ELSE 'Wrote' END AS role, s.stat_title AS title,
                 CASE WHEN s.stat_type = 'resolution' THEN 'Debate' ELSE initcap(s.stat_type::text) END AS pre, r.stat_title AS sub,
                 c.id AS cid, c.name AS society, c.subdomain AS slug, COALESCE(s.resolution_id, s.id)::text AS l1,
                 CASE WHEN s.stat_type = 'resolution' THEN NULL ELSE s.id::text END AS l2, s.created_at AS at
          FROM statements s LEFT JOIN statements r ON r.id = s.resolution_id LEFT JOIN customers c ON c.id = COALESCE(r.customer_id, s.customer_id)
          WHERE s.created_by = $1 AND s.retracted_at IS NULL AND s.stat_status::text <> 'deleted' AND ${IN_SOCIETY}` },
  { type: 'debate', href: r => `/chamber?resolution=${r.l1}&statement=${r.l2}`,
    sql: `SELECT sv.id::text AS id, CASE sv.vote::text WHEN 'agree' THEN 'Agreed' ELSE 'Disagreed' END AS role, s.stat_title AS title,
                 initcap(s.stat_type::text) AS pre, r.stat_title AS sub,
                 c.id AS cid, c.name AS society, c.subdomain AS slug, COALESCE(s.resolution_id, s.id)::text AS l1, s.id::text AS l2, sv.created_at AS at
          FROM stat_votes sv JOIN statements s ON s.id = sv.statement_id LEFT JOIN statements r ON r.id = s.resolution_id
          LEFT JOIN customers c ON c.id = COALESCE(r.customer_id, s.customer_id)
          WHERE sv.created_by = $1 AND ${IN_SOCIETY}` },
  // ── Project tasks: created, or allocated to you
  { type: 'project_tasks', href: (r, s) => `${s}/projects/${r.l1}?task=${r.l2}`,
    sql: `SELECT k.id::text AS id, 'Created' AS role, k.name AS title, pr.name AS sub, c.id AS cid, c.name AS society, c.subdomain AS slug,
                 pr.id::text AS l1, k.id::text AS l2, k.created_at AS at, (SELECT json_agg(json_build_object('name', tc.name, 'color', tc.color) ORDER BY tc.sort_order, tc.name) FROM task_category_links l JOIN task_categories tc ON tc.id = l.category_id WHERE l.project_task_id = k.id AND tc.owner_id = $1) AS cats, k.status AS pstatus
          FROM project_tasks k JOIN projects pr ON pr.id = k.project_id AND pr.deleted_at IS NULL JOIN customers c ON c.id = pr.customer_id
          WHERE k.created_by = $1 AND ${IN_SOCIETY}` },
  { type: 'project_tasks', href: (r, s) => `${s}/projects/${r.l1}?task=${r.l2}`,
    sql: `SELECT k.id::text || ':a' AS id, 'Allocated' AS role, k.name AS title, pr.name AS sub, c.id AS cid, c.name AS society, c.subdomain AS slug,
                 pr.id::text AS l1, k.id::text AS l2, a.assigned_at AS at, (SELECT json_agg(json_build_object('name', tc.name, 'color', tc.color) ORDER BY tc.sort_order, tc.name) FROM task_category_links l JOIN task_categories tc ON tc.id = l.category_id WHERE l.project_task_id = k.id AND tc.owner_id = $1) AS cats, k.status AS pstatus
          FROM project_task_assignees a JOIN project_tasks k ON k.id = a.task_id JOIN projects pr ON pr.id = k.project_id AND pr.deleted_at IS NULL
          JOIN customers c ON c.id = pr.customer_id
          WHERE a.user_id = $1 AND ${IN_SOCIETY}` },
  // ── Debate chat and flags (from the old My Content page)
  { type: 'debate', href: r => `/chamber?resolution=${r.l1}&statement=${r.l2}`,
    sql: `SELECT cm.id::text AS id, 'Chat' AS role, cm.comment_body AS title, 'On' AS pre, COALESCE(r.stat_title, s.stat_title) AS sub,
                 c.id AS cid, c.name AS society, c.subdomain AS slug, COALESCE(s.resolution_id, s.id)::text AS l1, s.id::text AS l2, cm.created_at AS at
          FROM comments cm JOIN statements s ON s.id = cm.statement_id LEFT JOIN statements r ON r.id = s.resolution_id
          LEFT JOIN customers c ON c.id = COALESCE(r.customer_id, s.customer_id)
          WHERE cm.created_by = $1 AND NOT cm.is_deleted AND ${IN_SOCIETY}` },
  { type: 'debate', href: r => `/chamber?resolution=${r.l1}&statement=${r.l2}`,
    sql: `SELECT f.id::text AS id, 'Flagged' AS role, s.stat_title AS title, 'Reason' AS pre, f.reason AS sub,
                 c.id AS cid, c.name AS society, c.subdomain AS slug, COALESCE(s.resolution_id, s.id)::text AS l1, s.id::text AS l2, f.created_at AS at
          FROM stat_flags f JOIN statements s ON s.id = f.stat_id LEFT JOIN statements r ON r.id = s.resolution_id
          LEFT JOIN customers c ON c.id = COALESCE(r.customer_id, s.customer_id)
          WHERE f.flagged_by = $1 AND ${IN_SOCIETY}` },
  // ── Status reports on project tasks, and risks / issues logged in projects
  { type: 'project_tasks', href: (r, s) => `${s}/projects/${r.l1}?task=${r.l2}`,
    sql: `SELECT sr.id::text AS id, 'Reported' AS role, k.name AS title, sr.body AS sub, c.id AS cid, c.name AS society, c.subdomain AS slug,
                 pr.id::text AS l1, k.id::text AS l2, sr.created_at AS at, (SELECT json_agg(json_build_object('name', tc.name, 'color', tc.color) ORDER BY tc.sort_order, tc.name) FROM task_category_links l JOIN task_categories tc ON tc.id = l.category_id WHERE l.project_task_id = k.id AND tc.owner_id = $1) AS cats, k.status AS pstatus
          FROM project_status_reports sr JOIN project_tasks k ON k.id = sr.task_id JOIN projects pr ON pr.id = k.project_id AND pr.deleted_at IS NULL
          JOIN customers c ON c.id = pr.customer_id
          WHERE sr.user_id = $1 AND ${IN_SOCIETY}` },
  { type: 'projects', href: (r, s) => `${s}/projects/${r.l1}?tab=report`,
    sql: `SELECT x.id::text AS id, initcap(x.kind) AS role, x.name AS title, pr.name AS sub, c.id AS cid, c.name AS society, c.subdomain AS slug,
                 pr.id::text AS l1, NULL AS l2, x.created_at AS at
          FROM project_raid x JOIN projects pr ON pr.id = x.project_id AND pr.deleted_at IS NULL JOIN customers c ON c.id = pr.customer_id
          WHERE x.created_by = $1 AND ${IN_SOCIETY}` },
  // ── Principle review requests
  { type: 'principles', href: (r, s) => `${s}/principles`,
    sql: `SELECT rv.id::text AS id, initcap(replace(rv.status, '_', ' ')) AS role, rv.request_text AS title, NULL AS sub,
                 c.id AS cid, c.name AS society, c.subdomain AS slug, NULL AS l1, NULL AS l2, rv.created_at AS at
          FROM society_principle_reviews rv JOIN customers c ON c.id = rv.customer_id
          WHERE rv.user_id = $1 AND ${IN_SOCIETY}` },
  // ── Your requests to join, and invitations to you, with the decision (dated by the decision).
  //    Shown even for Societies you're not in yet — they're your own requests; never for closed ones.
  { type: 'requests', href: (r, s) => r.l2 ? `/chamber?resolution=${r.l2}` : r.l1 === 'approved' ? s : `${s}/about`,
    sql: `SELECT j.id::text AS id, ${DECISION('j.status')} AS role, c.name AS title, 'Request to join the Society' AS sub,
                 c.id AS cid, c.name AS society, c.subdomain AS slug, j.status AS l1, NULL AS l2, COALESCE(j.decided_at, j.created_at) AS at
          FROM society_join_requests j JOIN customers c ON c.id = j.customer_id
          WHERE j.user_id = $1::text AND c.status IS DISTINCT FROM 'closed'
          UNION ALL
          SELECT j.id::text, ${DECISION('j.status')}, r.stat_title, 'Request to join the debate',
                 c.id, c.name, c.subdomain, j.status, r.id::text, CASE WHEN j.status = 'pending' THEN j.created_at ELSE j.updated_at END
          FROM debate_join_requests j JOIN statements r ON r.id = j.resolution_id LEFT JOIN customers c ON c.id = r.customer_id
          WHERE j.user_id = $1::text AND c.status IS DISTINCT FROM 'closed'` },
  { type: 'requests', href: r => r.l1 === 'pending' ? '/dashboard/invitations' : `/chamber?resolution=${r.l2}`,
    sql: `SELECT i.id::text AS id, ${DECISION('i.status')} AS role, r.stat_title AS title, 'Invitation from @' || COALESCE(u.user_handle, 'a Society Admin') AS sub,
                 c.id AS cid, c.name AS society, c.subdomain AS slug, i.status AS l1, r.id::text AS l2,
                 CASE WHEN i.status = 'pending' THEN i.created_at ELSE i.updated_at END AS at
          FROM debate_invitations i JOIN statements r ON r.id = i.resolution_id LEFT JOIN customers c ON c.id = r.customer_id
          LEFT JOIN users u ON u.id = i.created_by
          WHERE (i.invitee_user_id = $1::text OR lower(i.invitee_email) = (SELECT lower(email) FROM users WHERE id = $1::uuid))
            AND c.status IS DISTINCT FROM 'closed'` },
  // ── Your personal tasks (dated by their last change)
  { type: 'tasks', href: (r, s) => `${s}/tasks?task=${r.l1}`,
    sql: `SELECT t.id::text AS id, CASE t.status WHEN 'new' THEN 'New' WHEN 'in_progress' THEN 'In progress' WHEN 'paused' THEN 'Paused' ELSE 'Complete' END AS role,
                 t.name AS title, 'T-' || lpad(t.number::text, 4, '0') || COALESCE(' · due ' || ${day('t.due_date::timestamp')}, '') AS sub,
                 c.id AS cid, c.name AS society, c.subdomain AS slug, t.id::text AS l1, NULL AS l2, COALESCE(t.updated_at, t.created_at) AS at, (SELECT json_agg(json_build_object('name', tc.name, 'color', tc.color) ORDER BY tc.sort_order, tc.name) FROM task_category_links l JOIN task_categories tc ON tc.id = l.category_id WHERE l.task_id = t.id AND tc.owner_id = $1) AS cats
          FROM society_tasks t JOIN customers c ON c.id = t.customer_id
          WHERE t.owner_id = $1 AND t.deleted_at IS NULL AND ${IN_SOCIETY}` },
];

// Messages and notes can hold markup: keep a plain one-line excerpt
const plain = (s: string | null, max: number) => s == null ? null
  : s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
     .replace(/[*_`#>]+/g, '').replace(/\s+/g, ' ').trim().slice(0, max) || null;

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const failed: string[] = [];
  const parts = await Promise.all(QUERIES.map(async q => {
    try {
      const { rows } = await pool.query(`SELECT * FROM (${q.sql}) x ORDER BY at DESC NULLS LAST LIMIT ${LIMIT}`, [session.sub]);
      await openDeep(rows);
      await hideEndToEnd(rows);
      return (rows as Row[]).map(r => {
        let title = r.title ?? '';
        if (q.type === 'polls') { try { title = JSON.parse(title).title ?? 'Poll'; } catch { title = title.startsWith('🔐') || title.startsWith('🔒') ? title : 'Poll'; } }
        const soc = `/society/${r.slug || r.cid}`;
        return {
          key: `${q.type}:${r.id}`, type: q.type, role: r.role,
          title: plain(title, 300) || 'Untitled', sub: plain([r.pre, r.sub].filter(Boolean).join(' · '), 300),
          society: r.cid ? { id: r.cid, name: r.society ?? 'Society' } : null,
          href: q.href(r, soc), at: r.at,
          ...(r.cats !== undefined ? { cats: (r.cats ?? []).filter(c => c && typeof c.name === 'string') } : {}),
          ...(r.pstatus ? { status: r.pstatus } : {}),
        };
      });
    } catch (err) {
      console.error(`[my stuff:${q.type}]`, err);
      failed.push(q.type); return [];
    }
  }));
  const items = parts.flat().filter(i => i.at);
  return NextResponse.json({ items, failed: [...new Set(failed)] }, { headers: { 'Cache-Control': 'no-store' } });
}
