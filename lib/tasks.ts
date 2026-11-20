// Society Tasks: a member's own quick to-do list, outside Projects. Private to
// the author unless shared (read-only) with everyone in the Society or with
// chosen members. Categories are each member's own; priorities are the
// Society's. Text is always encrypted with the Society's key. Server-only.

import type { NextRequest } from 'next/server';
import pool from './db';
import { societyContentAccess, type SocietyContentAccess } from './societies';
import { openRows, sealText } from './societyCrypto';

export const QUICK_STATUSES = ['new', 'in_progress', 'paused', 'complete'] as const;
export const TITLE_MAX = 300;
export const RICH_MAX = 100_000;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLOR_RE = /^#[0-9a-f]{6}$/i;

export const DEFAULT_PRIORITIES = [
  { name: 'High', color: '#ef4444' },
  { name: 'Medium', color: '#f59e0b' },
  { name: 'Low', color: '#64748b' },
];

export type TaskAccess = SocietyContentAccess & { me: string };

/** A member of the Society, signed in (Tasks are a members' tool). */
export async function taskAccess(req: NextRequest, rawId: string): Promise<{ a: TaskAccess } | { error: string; status: number }> {
  const a = await societyContentAccess(req, rawId);
  if (!a) return { error: 'Not found', status: 404 };
  if (!a.session) return { error: 'Log in to use Tasks', status: 401 };
  if (!a.isMember) return { error: 'Tasks are for members of this Society', status: 403 };
  return { a: { ...a, me: a.session.sub } };
}

/** SQL (task aliased t; $n = the viewer) for "this person may see this task". */
export const canSeeSql = (me: string) =>
  `(t.owner_id = ${me} OR t.shared_all OR EXISTS (SELECT 1 FROM task_shares s WHERE s.task_id = t.id AND s.user_id = ${me}))`;

/** The Society's priorities, created as High / Medium / Low the first time they're needed. */
export async function priorities(societyId: number) {
  let { rows } = await pool.query(
    'SELECT id, name, color, sort_order FROM task_priorities WHERE customer_id = $1 ORDER BY sort_order, created_at', [societyId]);
  if (!rows.length) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`task_priorities:${societyId}`]);
      const { rows: again } = await client.query('SELECT 1 FROM task_priorities WHERE customer_id = $1', [societyId]);
      if (!again.length) {
        for (const [i, p] of DEFAULT_PRIORITIES.entries()) {
          await client.query('INSERT INTO task_priorities (customer_id, name, color, sort_order) VALUES ($1, $2, $3, $4)',
            [societyId, await sealText(societyId, p.name), p.color, i]);
        }
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    ({ rows } = await pool.query(
      'SELECT id, name, color, sort_order FROM task_priorities WHERE customer_id = $1 ORDER BY sort_order, created_at', [societyId]));
  }
  return openRows(societyId, rows, ['name']);
}

/** This member's categories. */
export async function myCategories(societyId: number, me: string) {
  const { rows } = await pool.query(
    'SELECT id, name, color, sort_order FROM task_categories WHERE customer_id = $1 AND owner_id = $2 ORDER BY sort_order, created_at',
    [societyId, me]);
  return openRows(societyId, rows, ['name']);
}

export const readColor = (v: unknown, fallback = '#64748b') => typeof v === 'string' && COLOR_RE.test(v) ? v.toLowerCase() : fallback;
export const readName = (v: unknown, max = 60) => typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

export function readDate(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) ? v : undefined;
}

/** Rich text from the browser (HTML; cleaned again whenever it's shown). */
export function readRich(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (!t.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim()) return null;   // empty editor
  return t.length > RICH_MAX ? undefined : t;
}

/** Ids from a list that are this member's categories. */
export async function ownCategoryIds(societyId: number, me: string, v: unknown): Promise<string[] | undefined> {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) return [];
  const ids = [...new Set(v.filter((x): x is string => typeof x === 'string' && UUID_RE.test(x)))].slice(0, 50);
  if (!ids.length) return [];
  const { rows } = await pool.query('SELECT id FROM task_categories WHERE customer_id = $1 AND owner_id = $2 AND id = ANY($3::uuid[])', [societyId, me, ids]);
  return rows.map(r => r.id);
}

/** Ids from a list that are this Society's members (other than me). */
export async function memberIds(societyId: number, me: string, v: unknown): Promise<string[] | undefined> {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) return [];
  const ids = [...new Set(v.filter((x): x is string => typeof x === 'string' && UUID_RE.test(x) && x !== me))].slice(0, 200);
  if (!ids.length) return [];
  const { rows } = await pool.query(
    `SELECT u.id FROM users u WHERE u.id = ANY($2::uuid[]) AND u.id::text IN
       (SELECT user_id::text FROM customer_members WHERE customer_id = $1
        UNION SELECT user_id::text FROM customer_roles WHERE tenant_id = $1 AND role = 'customer_admin')`,
    [societyId, ids]);
  return rows.map(r => r.id);
}

/** Replace this member's categories on a task (or a Project Task), leaving others' alone. */
export async function setMyCategories(me: string, target: { taskId?: string; projectTaskId?: string }, ids: string[]) {
  const col = target.taskId ? 'task_id' : 'project_task_id';
  const id = target.taskId ?? target.projectTaskId;
  await pool.query(
    `DELETE FROM task_category_links l USING task_categories c
     WHERE l.category_id = c.id AND c.owner_id = $1 AND l.${col} = $2`, [me, id]);
  for (const cid of ids) {
    await pool.query(`INSERT INTO task_category_links (category_id, ${col}) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [cid, id]);
  }
}

/** Plain text from a task's rich text (for a Project Task, whose text is plain). */
export function plainText(html: string | null | undefined): string | null {
  if (!html) return null;
  const t = html
    .replace(/<\/(p|h[1-6]|li|blockquote|pre)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n').trim();
  return t || null;
}

/** A priority of this Society (null: none; false: not one of its priorities). */
export async function priorityId(societyId: number, v: unknown): Promise<string | null | false> {
  if (v == null || v === '') return null;
  if (typeof v !== 'string') return false;
  const { rows } = await pool.query('SELECT 1 FROM task_priorities WHERE id::text = $1 AND customer_id = $2', [v, societyId]);
  return rows.length ? v : false;
}
