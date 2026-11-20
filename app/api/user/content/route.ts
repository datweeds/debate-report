import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { hideEndToEnd, openDeep } from '@/lib/societyCrypto';

// Everything the signed-in user has contributed, by kind: a count, how many
// are new since a date, and the latest items. Their own content only.
//
// Each section's SQL returns: id, text, pre + sub (a detail line: a plain label,
// and text that may be encrypted, joined after decrypting), society, slug,
// href_id (whatever its link needs) and at (when). $1 = user.

type Section = { key: string; label: string; sql: string; href: (r: Row) => string | null };
type Row = { id: string; text: string | null; pre: string | null; sub: string | null; society: string | null; slug: string | null; cid: number | null; href_id: string | null; href_id2: string | null; at: string };

const soc = (r: Row) => `/society/${r.slug || r.cid}`;
// A request's or invitation's status, as the person who sent it reads it
const DECISION = (col: string) => `CASE ${col} WHEN 'pending' THEN 'Awaiting a decision' WHEN 'approved' THEN 'Approved' WHEN 'accepted' THEN 'Accepted'
  WHEN 'declined' THEN 'Declined' WHEN 'denied' THEN 'Rejected' WHEN 'rejected' THEN 'Rejected' ELSE initcap(${col}) END`;
// Sections whose detail line starts with a decision, shown as a badge instead
const DECIDED = new Set(['join_requests', 'invitations']);
const LIMIT = 100;

const SECTIONS: Section[] = [
  { key: 'debates', label: 'Debates you started',
    sql: `SELECT s.id, s.stat_title AS text, NULL AS pre, NULL AS sub, c.name AS society, c.subdomain AS slug, c.id AS cid, s.id::text AS href_id, NULL AS href_id2, s.created_at AS at
          FROM statements s LEFT JOIN customers c ON c.id = s.customer_id
          WHERE s.created_by = $1 AND s.stat_type = 'resolution' AND s.stat_status <> 'deleted'`,
    href: r => `/chamber?resolution=${r.href_id}` },
  { key: 'statements', label: 'Arguments and evidence',
    sql: `SELECT s.id, s.stat_title AS text, initcap(s.stat_type::text) AS pre, r.stat_title AS sub, c.name AS society, c.subdomain AS slug, c.id AS cid,
                 s.resolution_id::text AS href_id, s.id::text AS href_id2, s.created_at AS at
          FROM statements s JOIN statements r ON r.id = s.resolution_id LEFT JOIN customers c ON c.id = r.customer_id
          WHERE s.created_by = $1 AND s.stat_type <> 'resolution' AND s.retracted_at IS NULL`,
    href: r => `/chamber?resolution=${r.href_id}&statement=${r.href_id2}` },
  { key: 'debate_votes', label: 'Debate votes',
    sql: `SELECT sv.id, s.stat_title AS text, (CASE sv.vote WHEN 'agree' THEN 'Agreed' ELSE 'Disagreed' END) AS pre, COALESCE(r.stat_title, s.stat_title) AS sub,
                 c.name AS society, c.subdomain AS slug, c.id AS cid, COALESCE(s.resolution_id, s.id)::text AS href_id, s.id::text AS href_id2, sv.created_at AS at
          FROM stat_votes sv JOIN statements s ON s.id = sv.statement_id LEFT JOIN statements r ON r.id = s.resolution_id
          LEFT JOIN customers c ON c.id = COALESCE(r.customer_id, s.customer_id)
          WHERE sv.created_by = $1`,
    href: r => `/chamber?resolution=${r.href_id}&statement=${r.href_id2}` },
  { key: 'chat', label: 'Debate chat',
    sql: `SELECT cm.id, cm.comment_body AS text, 'On' AS pre, COALESCE(r.stat_title, s.stat_title) AS sub, c.name AS society, c.subdomain AS slug, c.id AS cid,
                 COALESCE(s.resolution_id, s.id)::text AS href_id, s.id::text AS href_id2, cm.created_at AS at
          FROM comments cm JOIN statements s ON s.id = cm.statement_id LEFT JOIN statements r ON r.id = s.resolution_id
          LEFT JOIN customers c ON c.id = COALESCE(r.customer_id, s.customer_id)
          WHERE cm.created_by = $1 AND NOT cm.is_deleted`,
    href: r => `/chamber?resolution=${r.href_id}&statement=${r.href_id2}` },
  { key: 'poll_votes', label: 'Polls you voted in',
    sql: `SELECT p.id, p.payload AS text, CASE p.status WHEN 'open' THEN 'Open' ELSE 'Closed' END AS pre, NULL AS sub, c.name AS society, c.subdomain AS slug, c.id AS cid,
                 p.id::text AS href_id, NULL AS href_id2, pp.voted_at AS at
          FROM poll_participants pp JOIN society_polls p ON p.id = pp.poll_id AND p.deleted_at IS NULL JOIN customers c ON c.id = p.customer_id
          WHERE pp.user_id = $1`,
    href: r => `${soc(r)}/polls/${r.href_id}` },
  { key: 'polls', label: 'Polls you created',
    sql: `SELECT p.id, p.payload AS text, initcap(p.status) || ' · ' || p.vote_count || ' voted' AS pre, NULL AS sub, c.name AS society, c.subdomain AS slug, c.id AS cid,
                 p.id::text AS href_id, NULL AS href_id2, p.created_at AS at
          FROM society_polls p JOIN customers c ON c.id = p.customer_id WHERE p.created_by = $1 AND p.deleted_at IS NULL`,
    href: r => `${soc(r)}/polls/${r.href_id}` },
  { key: 'threads', label: 'Discussions you started',
    sql: `SELECT t.id, t.title AS text, NULL AS pre, NULL AS sub, c.name AS society, c.subdomain AS slug, c.id AS cid, t.id::text AS href_id, NULL AS href_id2, t.created_at AS at
          FROM discussion_threads t JOIN customers c ON c.id = t.customer_id WHERE t.created_by = $1 AND t.deleted_at IS NULL`,
    href: r => `${soc(r)}/discussions/${r.href_id}` },
  { key: 'posts', label: 'Discussion messages',
    sql: `SELECT p.id, p.body AS text, 'In' AS pre, t.title AS sub, c.name AS society, c.subdomain AS slug, c.id AS cid, t.id::text AS href_id, NULL AS href_id2, p.created_at AS at
          FROM discussion_posts p JOIN discussion_threads t ON t.id = p.thread_id AND t.deleted_at IS NULL JOIN customers c ON c.id = t.customer_id
          WHERE p.created_by = $1 AND p.deleted_at IS NULL`,
    href: r => `${soc(r)}/discussions/${r.href_id}` },
  { key: 'documents', label: 'Documents you shared',
    sql: `SELECT d.id, d.title AS text, CASE d.kind WHEN 'link' THEN 'Link' ELSE 'File' END AS pre, NULL AS sub, c.name AS society, c.subdomain AS slug, c.id AS cid,
                 d.folder_id::text AS href_id, NULL AS href_id2, d.created_at AS at
          FROM documents d JOIN customers c ON c.id = d.customer_id WHERE d.uploaded_by = $1 AND d.deleted_at IS NULL`,
    href: r => `${soc(r)}/documents${r.href_id ? `?folder=${r.href_id}` : ''}` },
  { key: 'events', label: 'Events you added',
    sql: `SELECT e.id, e.title AS text, to_char(e.starts_at AT TIME ZONE 'Europe/London', 'DD Mon YYYY') AS pre, NULL AS sub, c.name AS society, c.subdomain AS slug, c.id AS cid,
                 NULL AS href_id, NULL AS href_id2, e.created_at AS at
          FROM society_events e JOIN customers c ON c.id = e.customer_id WHERE e.created_by = $1 AND e.deleted_at IS NULL`,
    href: r => `${soc(r)}/events` },
  { key: 'tasks', label: 'Project tasks allocated to you',
    sql: `SELECT k.id, k.name AS text, NULL AS pre, pr.name AS sub, c.name AS society, c.subdomain AS slug, c.id AS cid, pr.id::text AS href_id, NULL AS href_id2, a.assigned_at AS at
          FROM project_task_assignees a JOIN project_tasks k ON k.id = a.task_id JOIN projects pr ON pr.id = k.project_id AND pr.deleted_at IS NULL
          JOIN customers c ON c.id = pr.customer_id WHERE a.user_id = $1`,
    href: r => `${soc(r)}/projects/${r.href_id}` },
  { key: 'status_reports', label: 'Status reports you filed',
    sql: `SELECT sr.id, sr.body AS text, 'On' AS pre, k.name AS sub, c.name AS society, c.subdomain AS slug, c.id AS cid, pr.id::text AS href_id, NULL AS href_id2, sr.created_at AS at
          FROM project_status_reports sr JOIN project_tasks k ON k.id = sr.task_id JOIN projects pr ON pr.id = k.project_id AND pr.deleted_at IS NULL
          JOIN customers c ON c.id = pr.customer_id WHERE sr.user_id = $1`,
    href: r => `${soc(r)}/projects/${r.href_id}` },
  { key: 'raid', label: 'Risks and issues you logged',
    sql: `SELECT x.id, x.name AS text, initcap(x.kind) AS pre, pr.name AS sub, c.name AS society, c.subdomain AS slug, c.id AS cid, pr.id::text AS href_id, NULL AS href_id2, x.created_at AS at
          FROM project_raid x JOIN projects pr ON pr.id = x.project_id AND pr.deleted_at IS NULL JOIN customers c ON c.id = pr.customer_id WHERE x.created_by = $1`,
    href: r => `${soc(r)}/projects/${r.href_id}` },
  { key: 'reviews', label: 'Principle review requests',
    sql: `SELECT rv.id, rv.request_text AS text, initcap(replace(rv.status, '_', ' ')) AS pre, NULL AS sub, c.name AS society, c.subdomain AS slug, c.id AS cid,
                 NULL AS href_id, NULL AS href_id2, rv.created_at AS at
          FROM society_principle_reviews rv JOIN customers c ON c.id = rv.customer_id WHERE rv.user_id = $1`,
    href: r => `${soc(r)}/principles` },
  { key: 'flags', label: 'Statements you flagged',
    sql: `SELECT f.id, s.stat_title AS text, NULL AS pre, f.reason AS sub, c.name AS society, c.subdomain AS slug, c.id AS cid,
                 COALESCE(s.resolution_id, s.id)::text AS href_id, s.id::text AS href_id2, f.created_at AS at
          FROM stat_flags f JOIN statements s ON s.id = f.stat_id LEFT JOIN statements r ON r.id = s.resolution_id
          LEFT JOIN customers c ON c.id = COALESCE(r.customer_id, s.customer_id) WHERE f.flagged_by = $1`,
    href: r => `/chamber?resolution=${r.href_id}&statement=${r.href_id2}` },
  // Requests to join a Society or an Apply debate, with the decision once made
  // (dated by the decision, so a fresh answer shows as new)
  { key: 'join_requests', label: 'Join requests',
    sql: `SELECT j.id, c.name AS text, ${DECISION('j.status')} AS pre, 'Society' AS sub, c.name AS society, c.subdomain AS slug, c.id AS cid,
                 j.status AS href_id, NULL AS href_id2, COALESCE(j.decided_at, j.created_at) AS at
          FROM society_join_requests j JOIN customers c ON c.id = j.customer_id WHERE j.user_id = $1::text
          UNION ALL
          SELECT j.id, r.stat_title AS text, ${DECISION('j.status')} AS pre, 'Debate' AS sub, c.name AS society, c.subdomain AS slug, c.id AS cid,
                 j.status AS href_id, r.id::text AS href_id2, CASE WHEN j.status = 'pending' THEN j.created_at ELSE j.updated_at END AS at
          FROM debate_join_requests j JOIN statements r ON r.id = j.resolution_id LEFT JOIN customers c ON c.id = r.customer_id
          WHERE j.user_id = $1::text`,
    href: r => r.href_id2 ? `/chamber?resolution=${r.href_id2}` : r.href_id === 'approved' ? soc(r) : `${soc(r)}/about` },
  { key: 'invitations', label: 'Invitations to you',
    sql: `SELECT i.id, r.stat_title AS text, ${DECISION('i.status')} AS pre, 'From ' || COALESCE(u.user_handle, 'a moderator') AS sub, c.name AS society, c.subdomain AS slug, c.id AS cid,
                 i.status AS href_id, r.id::text AS href_id2, CASE WHEN i.status = 'pending' THEN i.created_at ELSE i.updated_at END AS at
          FROM debate_invitations i JOIN statements r ON r.id = i.resolution_id LEFT JOIN customers c ON c.id = r.customer_id
          LEFT JOIN users u ON u.id = i.created_by
          WHERE i.invitee_user_id = $1::text OR lower(i.invitee_email) = (SELECT lower(email) FROM users WHERE id = $1::uuid)`,
    href: r => r.href_id === 'pending' ? '/dashboard/invitations' : `/chamber?resolution=${r.href_id2}` },
];

// GET ?since=YYYY-MM-DD (default: 7 days ago)
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const s = req.nextUrl.searchParams.get('since');
  const since = s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) ? new Date(s) : new Date(Date.now() - 7 * 86400e3);

  const sections = await Promise.all(SECTIONS.map(async sec => {
    try {
      const [{ rows: [n] }, { rows }] = await Promise.all([
        pool.query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE at > $2)::int AS recent FROM (${sec.sql}) x`, [session.sub, since]),
        pool.query(`SELECT * FROM (${sec.sql}) x ORDER BY at DESC LIMIT ${LIMIT}`, [session.sub]),
      ]);
      await openDeep(rows);
      await hideEndToEnd(rows);
      const items = (rows as Row[]).map(r => {
        let text = r.text ?? '';
        // A poll's text is its encrypted payload: show its title
        if (sec.key === 'poll_votes' || sec.key === 'polls') { try { text = JSON.parse(text).title ?? 'Poll'; } catch { text = text.startsWith('🔒') ? text : 'Poll'; } }
        const decided = DECIDED.has(sec.key);
        const sub = decided ? r.sub : r.pre && r.sub ? `${r.pre}${/^(In|On)$/.test(r.pre) ? ':' : ' ·'} ${r.sub}` : r.pre ?? r.sub;
        return { id: r.id, text: text.slice(0, 300), sub, society: r.society, href: sec.href(r), at: r.at, isNew: new Date(r.at) > since,
                 ...(decided ? { status: r.pre } : {}) };
      });
      return { key: sec.key, label: sec.label, total: n.total, recent: n.recent, items };
    } catch (err) {
      console.error(`[user content:${sec.key}]`, err);
      return { key: sec.key, label: sec.label, total: 0, recent: 0, items: [], error: true };
    }
  }));
  return NextResponse.json({ since: since.toISOString().slice(0, 10), sections }, { headers: { 'Cache-Control': 'no-store' } });
}
