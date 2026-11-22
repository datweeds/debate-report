// Reporting an item: an event, a discussion reply, a document, a poll… One
// report covers the whole item. Members and people without an account can
// report; what goes where:
//   possibly illegal, a whole Society, a profile → Sys Admin only, urgent when illegal
//   anything else → the Society's moderators, with Sys Admin as the backstop
// Reports land in content_alerts, the scanner's review queue. Server-only.

import crypto from 'crypto';
import pool from './db';
import type { SessionPayload } from './auth';
import { getSocietyAccess } from './societies';
import { statementAccess } from './debateAccess';
import { shareByToken, shareState } from './documentShares';
import { isEndToEnd, openText, sealText } from './societyCrypto';
import { PRODUCT_URL, sendContactNotification } from './postmark';
import { currentText, setText, MASK } from './scanner';

export const REPORT_REASONS: Record<string, string> = {
  illegal: 'Possibly illegal (e.g. terrorism, child abuse, threats, fraud)',
  harassment: 'Harassment or bullying',
  hate_speech: 'Hate speech',
  personal_data: 'Shares someone’s personal data',
  inappropriate: 'Inappropriate or offensive',
  spam: 'Spam or a scam',
  other: 'Something else',
};

export const ANON_PER_DAY = 5;         // per address, without an account
const MEMBER_PER_DAY = 30;             // per account
const ANON_ALL_PER_DAY = 300;          // everyone without an account together: a brake on address-hopping floods

type Row = Record<string, unknown> & { sid: number | null; author: string | null; href: string | null };
type Kind = {
  label: string;
  type: string;                      // content_alerts.content_type: a scanner type where there is one, so the queue can mask it
  sql: string;                       // one row for the item ($1 = its id): sid, author, href, and the text columns
  texts: [string, string][];         // [column, label] that make up what was reported
  platform?: boolean;                // always to Sys Admin
  mask: string[];                    // scanner types that masking the item hides (none: the moderator acts in the Society)
};

const S = (cid: string, path: string) => `'/society/' || ${cid} || '${path}'`;

export const REPORT_KINDS: Record<string, Kind> = {
  discussion_post: {
    mask: ['discussion_post'],
    label: 'Discussion reply', type: 'discussion_post',
    sql: `SELECT th.customer_id AS sid, t.created_by AS author, ${S('th.customer_id', "/discussions/' || th.id || '")} AS href, t.body
            FROM discussion_posts t JOIN discussion_threads th ON th.id = t.thread_id
           WHERE t.id::text = $1 AND t.deleted_at IS NULL AND th.deleted_at IS NULL`,
    texts: [['body', 'Message']],
  },
  discussion_thread: {
    mask: ['discussion_title'],
    label: 'Discussion', type: 'discussion_title',
    sql: `SELECT t.customer_id AS sid, t.created_by AS author, ${S('t.customer_id', "/discussions/' || t.id || '")} AS href, t.title
            FROM discussion_threads t WHERE t.id::text = $1 AND t.deleted_at IS NULL`,
    texts: [['title', 'Title']],
  },
  document: {
    mask: ['document_title', 'document_description', 'document_body'],
    label: 'Document', type: 'document_title',
    sql: `SELECT t.customer_id AS sid, t.uploaded_by AS author,
                 '/society/' || t.customer_id || '/documents' || COALESCE('?folder=' || t.folder_id, '') AS href,
                 t.kind, t.title, t.file_name, t.description, t.body, t.url, t.size_bytes
            FROM documents t WHERE t.id::text = $1 AND t.deleted_at IS NULL`,
    texts: [['title', 'Title'], ['file_name', 'File'], ['url', 'Link'], ['description', 'Description'], ['body', 'Note']],
  },
  event: {
    mask: ['event_title', 'event_description', 'event_location'],
    label: 'Event', type: 'event_title',
    sql: `SELECT t.customer_id AS sid, t.created_by AS author, ${S('t.customer_id', '/events')} AS href, t.title, t.description, t.location
            FROM society_events t WHERE t.id::text = $1 AND t.deleted_at IS NULL`,
    texts: [['title', 'Title'], ['description', 'Description'], ['location', 'Location']],
  },
  project: {
    mask: ['project_name', 'project_description'],
    label: 'Project', type: 'project_name',
    sql: `SELECT t.customer_id AS sid, t.created_by AS author, ${S('t.customer_id', "/projects/' || t.id || '")} AS href, t.name, t.description
            FROM projects t WHERE t.id::text = $1 AND t.deleted_at IS NULL`,
    texts: [['name', 'Name'], ['description', 'Description']],
  },
  project_task: {
    mask: ['task_name', 'task_description', 'task_comments'],
    label: 'Project task', type: 'task_name',
    sql: `SELECT p.customer_id AS sid, t.created_by AS author, ${S('p.customer_id', "/projects/' || p.id || '")} AS href, t.name, t.description, t.comments
            FROM project_tasks t JOIN projects p ON p.id = t.project_id WHERE t.id::text = $1 AND p.deleted_at IS NULL`,
    texts: [['name', 'Name'], ['description', 'Description'], ['comments', 'Comments']],
  },
  society_task: {
    mask: ['society_task_name', 'society_task_description', 'society_task_notes'],
    label: 'Task', type: 'society_task_name',
    sql: `SELECT t.customer_id AS sid, t.owner_id AS author, ${S('t.customer_id', "/tasks?task=' || t.id || '")} AS href, t.name, t.description, t.notes
            FROM society_tasks t WHERE t.id::text = $1 AND t.deleted_at IS NULL
             AND (t.shared_all OR EXISTS (SELECT 1 FROM task_shares s WHERE s.task_id = t.id))`,
    texts: [['name', 'Name'], ['description', 'Description'], ['notes', 'Notes']],
  },
  poll: {
    mask: [],
    label: 'Poll', type: 'poll',
    sql: `SELECT t.customer_id AS sid, t.created_by AS author, ${S('t.customer_id', "/polls/' || t.id || '")} AS href, t.payload
            FROM society_polls t WHERE t.id::text = $1 AND t.deleted_at IS NULL`,
    texts: [],
  },
  principle: {
    mask: ['principle_title', 'principle_body', 'principle_grounding'],
    label: 'Principle', type: 'principle_title',
    sql: `SELECT v.customer_id AS sid, v.created_by AS author, ${S('v.customer_id', '/principles')} AS href, t.title, t.body, t.grounding
            FROM society_principles t JOIN society_principle_versions v ON v.id = t.version_id
           WHERE t.id::text = $1 AND v.is_current`,
    texts: [['title', 'Title'], ['body', 'Principle'], ['grounding', 'Reasoning']],
  },
  statement: {
    mask: ['statement_title', 'statement_description'],
    label: 'Debate statement', type: 'statement_description',
    sql: `SELECT COALESCE(r.customer_id, t.customer_id) AS sid, t.created_by AS author,
                 '/chamber?resolution=' || COALESCE(t.resolution_id, t.id) || '&statement=' || t.id AS href,
                 COALESCE(t.resolution_id, t.id) AS resolution_id, t.stat_title, t.stat_description
            FROM statements t LEFT JOIN statements r ON r.id = t.resolution_id WHERE t.id::text = $1`,
    texts: [['stat_title', 'Title'], ['stat_description', 'Text']],
  },
  comment: {
    mask: ['comment'],
    label: 'Debate chat message', type: 'comment',
    sql: `SELECT COALESCE(r.customer_id, s.customer_id) AS sid, t.created_by AS author, t.statement_id,
                 '/chamber?resolution=' || COALESCE(s.resolution_id, s.id) || '&statement=' || s.id AS href,
                 COALESCE(s.resolution_id, s.id) AS resolution_id, t.comment_title, t.comment_body
            FROM comments t JOIN statements s ON s.id = t.statement_id LEFT JOIN statements r ON r.id = s.resolution_id
           WHERE t.id::text = $1 AND NOT t.is_deleted`,
    texts: [['comment_title', 'Title'], ['comment_body', 'Message']],
  },
  society: {
    mask: ['society_name', 'society_hero_text', 'society_description'],
    label: 'Society', type: 'society_description', platform: true,
    sql: `SELECT t.id AS sid, CASE WHEN t.created_by ~* '^[0-9a-f-]{36}$' THEN t.created_by::uuid END AS author,
                 '/society/' || t.id AS href, t.name, t.hero_text, t.description
            FROM customers t WHERE t.id::text = $1`,
    texts: [['name', 'Name'], ['hero_text', 'Headline'], ['description', 'Description']],
  },
  profile: {
    mask: ['user_name', 'user_bio'],
    label: 'Profile', type: 'user_bio', platform: true,
    sql: `SELECT NULL::int AS sid, t.id AS author, NULL::text AS href, t.user_handle, t.user_full_name, t.user_bio
            FROM users t WHERE t.id::text = $1 AND t.user_status IS DISTINCT FROM 'closed'`,
    texts: [['user_handle', 'Handle'], ['user_full_name', 'Name'], ['user_bio', 'Bio']],
  },
};

export class ReportError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const daily = (s: string) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET ?? 'reports').update(`${new Date().toISOString().slice(0, 10)}|${s}`).digest('hex').slice(0, 32);

/** Count one report against a daily limit; false once it's used up. */
async function take(key: string, max: number): Promise<boolean> {
  const { rows: [r] } = await pool.query(
    `INSERT INTO report_limits (key, day, n) VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (key, day) DO UPDATE SET n = report_limits.n + 1 RETURNING n`, [key]);
  if (Math.random() < 0.05) pool.query(`DELETE FROM report_limits WHERE day < CURRENT_DATE - 2`).catch(() => {});
  return r.n <= max;
}

/** Whether this reporter may report one more item today (and counts it). */
export async function allowReport(session: SessionPayload | null, ip: string): Promise<boolean> {
  if (session) return take(`u:${session.sub}`, MEMBER_PER_DAY);
  if (!(await take(`ip:${daily(ip)}`, ANON_PER_DAY))) return false;
  return take('anon:all', ANON_ALL_PER_DAY);
}

async function mayReport(kind: string, id: string, row: Row, session: SessionPayload | null, share?: string): Promise<boolean> {
  if (kind === 'profile') return true;
  if (kind === 'statement') return !!(await statementAccess(session, id))?.viewable;
  if (kind === 'comment') return !!(await statementAccess(session, String(row.statement_id)))?.viewable;
  if (share) {
    // Someone with a share link can report that document
    const s = await shareByToken(share);
    return kind === 'document' && !!s && s.document_id === id && shareState(s) === 'ok';
  }
  if (row.sid == null) return false;
  const a = await getSocietyAccess(session, row.sid);
  if (!a) return false;
  return kind === 'society' ? a.canSeeTeaser : a.canEnter;
}

async function reportedText(kind: Kind, row: Row, shown: string): Promise<string> {
  const parts: string[] = [];
  let sealed = false;
  for (const [col, label] of kind.texts) {
    let v = row[col];
    if (v == null || v === '') continue;
    if (typeof v === 'string') {
      if (isEndToEnd(v)) { sealed = true; continue; }
      v = await openText(row.sid, v);
    }
    parts.push(`${label}: ${String(v).slice(0, 1500)}`);
  }
  if (kind.type === 'document_title' && row.size_bytes) parts.push(`Size: ${Math.round(Number(row.size_bytes) / 1024)} KB`);
  if (kind.type === 'poll') {
    const p = row.payload as { title?: string; questions?: { text?: string }[] } | string | null;
    if (typeof p === 'string') sealed = true;
    else if (p) parts.push(`Poll: ${p.title ?? ''}`, ...(p.questions ?? []).map((q, i) => `Q${i + 1}: ${q.text ?? ''}`));
  }
  if (sealed) {
    parts.push(shown.trim()
      ? `[Sealed: the server can’t read it. What the reporter saw:]\n${shown.trim().slice(0, 2000)}`
      : '[Sealed: the server can’t read it, and the reporter didn’t include the text. See their note.]');
  }
  return parts.join('\n').slice(0, 4000) || '[No text]';
}

export type ReportInput = { kind: string; id: string; reason: string; note?: string; shown?: string; share?: string };

/**
 * File a report. Throws ReportError with a message for the reporter.
 * Returns where it went: the Society's moderators, or the new.vote team.
 */
export async function submitReport(input: ReportInput, session: SessionPayload | null, ip: string,
                                   opts: { skipLimit?: boolean } = {}): Promise<{ route: 'society' | 'platform' }> {
  const kind = REPORT_KINDS[input.kind];
  // From a share link: the link says which document
  if (input.share && input.kind === 'document' && !input.id) {
    const sh = await shareByToken(input.share);
    if (sh) input = { ...input, id: sh.document_id };
  }
  if (!kind || typeof input.id !== 'string' || !input.id || input.id.length > 64) throw new ReportError('Nothing to report', 404);
  if (!REPORT_REASONS[input.reason]) throw new ReportError('Choose a reason');

  const { rows: [row] } = await pool.query<Row>(kind.sql, [input.id]);
  if (!row || !(await mayReport(input.kind, input.id, row, session, input.share))) throw new ReportError('Not found', 404);
  if (session && row.author === session.sub) throw new ReportError('You can’t report your own content');

  // One report per person per item
  const anonHash = session ? null : daily(ip);
  const { rows: [already] } = await pool.query(
    `SELECT 1 FROM content_alerts WHERE item_kind = $1 AND content_key = $2 AND report_route IS NOT NULL
       AND (reported_by = $3 OR (reporter_hash = $4 AND created_at > now() - interval '1 day'))`,
    [input.kind, input.id, session?.sub ?? null, anonHash]);
  if (already) throw new ReportError('You have already reported this', 409);

  if (!opts.skipLimit && !(await allowReport(session, ip))) {
    throw new ReportError(session
      ? 'You’ve made a lot of reports today. Please try again tomorrow, or contact us.'
      : `You can make up to ${ANON_PER_DAY} reports a day without an account. Please try again tomorrow, or sign in.`, 429);
  }

  const urgent = input.reason === 'illegal';
  const route: 'society' | 'platform' = urgent || kind.platform || row.sid == null ? 'platform' : 'society';
  const text = await reportedText(kind, row, input.shown ?? '');
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 1000) : '';
  const seal = (v: string) => (row.sid != null ? sealText(row.sid, v, true) : Promise.resolve(v));
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id) ? input.id : null;

  await pool.query(
    `INSERT INTO content_alerts (content_type, content_id, content_key, customer_id, resolution_id, content_href, flagged_text, flags,
                                 author_id, status, text_hash, reported_by, report_reason, urgent, report_route, reporter_hash, item_kind)
     VALUES ($1, $2::uuid, $3, $4, $5::uuid, $6, $7, ARRAY['reported', $8::text], $9, 'pending', $10, $11, $12, $13, $14, $15, $16)`,
    [kind.type, uuid, input.id, row.sid, (row.resolution_id as string | undefined) ?? null, row.href, await seal(text), input.reason,
     row.author, crypto.createHash('md5').update(`report:${session?.sub ?? anonHash}:${input.kind}:${input.id}`).digest('hex'),
     session?.sub ?? null, note ? await seal(note) : null, urgent, route, anonHash, input.kind]);

  // Tell people. No content in emails: they leave our servers
  let society = '', contact: string | null = null;
  if (row.sid != null) {
    const { rows: [c] } = await pool.query('SELECT name, contact_email FROM customers WHERE id = $1', [row.sid]);
    society = c?.name ?? ''; contact = c?.contact_email ?? null;
  }
  const where = society ? ` in ${society}` : '';
  const what = `${kind.label}${where}: ${REPORT_REASONS[input.reason]}`;
  const send = (to: string | undefined, subject: string, message: string) => sendContactNotification({
    name: 'new.vote', email: 'contact@new.vote', subject, message, context: 'new.vote moderation notices', ...(to ? { to } : {}),
  }).catch(err => console.error('[report] notify', err));
  const queue = `Review it in the alert queue: ${PRODUCT_URL}/dashboard/scanner`;
  if (route === 'platform') {
    void send(undefined, `${urgent ? 'URGENT: ' : ''}Report for the new.vote team (${kind.label})`,
      `A ${session ? 'member' : 'visitor without an account'} reported: ${what}.\n\n${queue}`);
  } else {
    const msg = `Someone reported content${where}.\n\n${what}\n\n${queue}`;
    if (contact) void send(contact, `Reported content in ${society}`, msg);
    void send(undefined, `Reported content in ${society}`, msg);
  }
  return { route };
}

type Q = { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

/** Mask every text of a reported item; returns what was there, to restore on appeal. */
export async function maskItem(q: Q, kind: string, id: string): Promise<string | null> {
  const types = REPORT_KINDS[kind]?.mask ?? [];
  if (!types.length) return null;
  const before: Record<string, string | null> = {};
  for (const t of types) {
    before[t] = await currentText(q, t, id);
    if (before[t] != null && before[t] !== '') await setText(q, t, id, MASK);
  }
  return JSON.stringify({ item: before });
}

export async function unmaskItem(q: Q, original: string, id: string) {
  const saved = (JSON.parse(original) as { item: Record<string, string | null> }).item;
  for (const [t, v] of Object.entries(saved)) if (v != null && v !== '') await setText(q, t, id, v);
}

export const canMaskKind = (kind: string | null | undefined) => !kind || (REPORT_KINDS[kind]?.mask.length ?? 0) > 0;
export const KIND_LABELS: Record<string, string> = Object.fromEntries(Object.entries(REPORT_KINDS).map(([k, v]) => [k, v.label]));
