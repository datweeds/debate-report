import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { openRows, sealText } from '@/lib/societyCrypto';
import { lockSafe } from '@/lib/lockSafe';
import {
  canSeeSql, memberIds, ownCategoryIds, priorityId, QUICK_STATUSES, readDate, readRich, setMyCategories,
  taskAccess, TITLE_MAX, UUID_RE,
} from '@/lib/tasks';

type Params = { params: Promise<{ id: string; tid: string }> };

async function load(societyId: number, me: string, tid: string) {
  if (!UUID_RE.test(tid)) return null;
  const { rows: [t] } = await pool.query(
    `SELECT t.id, t.number, t.owner_id, t.name, t.description, t.notes, t.status, t.priority_id, t.shared_all,
            to_char(t.due_date, 'YYYY-MM-DD') AS due_date, t.created_at, t.updated_at, t.completed_at,
            t.owner_id = $3 AS mine, u.user_handle AS owner
     FROM society_tasks t LEFT JOIN users u ON u.id = t.owner_id
     WHERE t.id = $1 AND t.customer_id = $2 AND t.deleted_at IS NULL AND ${canSeeSql('$3')}`,
    [tid, societyId, me]);
  return t ?? null;
}

// GET — one task this member may see.
export async function GET(req: NextRequest, { params }: Params) {
  const { id, tid } = await params;
  const r = await taskAccess(req, id);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const t = await load(r.a.societyId, r.a.me, tid);
  if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await openRows(r.a.societyId, [t], ['name', 'description', 'notes']);
  const res = NextResponse.json({ task: t });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

// PATCH — the author only (shared tasks are read-only to others):
// { name?, description?, notes?, status?, priorityId?, dueDate?, categoryIds?, sharedAll?, shareWith? }
async function handlePATCH(req: NextRequest, { params }: Params) {
  const { id, tid } = await params;
  const r = await taskAccess(req, id);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const { a } = r;
  const t = await load(a.societyId, a.me, tid);
  if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!t.mine) return NextResponse.json({ error: 'Only the task’s author can change it' }, { status: 403 });
  const b = await req.json().catch(() => ({}));

  const sets: string[] = []; const vals: unknown[] = [];
  const set = (c: string, v: unknown) => { vals.push(v); sets.push(`${c} = $${vals.length}`); };
  if (b.name !== undefined) {
    const name = typeof b.name === 'string' && b.name.trim() ? b.name.trim().slice(0, TITLE_MAX) : null;
    if (!name) return NextResponse.json({ error: 'Give the task a title' }, { status: 400 });
    set('name', await sealText(a.societyId, name, true));
  }
  for (const f of ['description', 'notes'] as const) {
    if (b[f] === undefined) continue;
    const v = readRich(b[f]);
    if (v === undefined) return NextResponse.json({ error: 'The description or notes are too long' }, { status: 413 });
    set(f, await sealText(a.societyId, v, true));
  }
  if (b.status !== undefined) {
    if (!(QUICK_STATUSES as readonly string[]).includes(b.status)) return NextResponse.json({ error: 'Unknown status' }, { status: 400 });
    set('status', b.status);
    if (b.status !== t.status) set('completed_at', b.status === 'complete' ? new Date() : null);
  }
  if (b.dueDate !== undefined) {
    const d = readDate(b.dueDate);
    if (d === undefined) return NextResponse.json({ error: 'That date wasn’t understood' }, { status: 400 });
    set('due_date', d);
  }
  if (b.priorityId !== undefined) {
    const p = await priorityId(a.societyId, b.priorityId);
    if (p === false) return NextResponse.json({ error: 'That priority wasn’t found' }, { status: 400 });
    set('priority_id', p);
  }
  if (typeof b.sharedAll === 'boolean') set('shared_all', b.sharedAll);
  if (sets.length) {
    vals.push(tid);
    await pool.query(`UPDATE society_tasks SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}`, vals);
  }
  const shareWith = await memberIds(a.societyId, a.me, b.shareWith);
  if (shareWith) {
    await pool.query('DELETE FROM task_shares WHERE task_id = $1 AND NOT (user_id = ANY($2::uuid[]))', [tid, shareWith]);
    for (const u of shareWith) await pool.query('INSERT INTO task_shares (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [tid, u]);
  }
  const cats = await ownCategoryIds(a.societyId, a.me, b.categoryIds);
  if (cats) await setMyCategories(a.me, { taskId: tid }, cats);
  return NextResponse.json({ ok: true });
}

// DELETE — the author.
async function handleDELETE(req: NextRequest, { params }: Params) {
  const { id, tid } = await params;
  const r = await taskAccess(req, id);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const t = await load(r.a.societyId, r.a.me, tid);
  if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!t.mine) return NextResponse.json({ error: 'Only the task’s author can delete it' }, { status: 403 });
  await pool.query('UPDATE society_tasks SET deleted_at = now() WHERE id = $1', [tid]);
  await pool.query('DELETE FROM task_shares WHERE task_id = $1', [tid]);
  return NextResponse.json({ ok: true });
}

export const PATCH = lockSafe(handlePATCH);
export const DELETE = lockSafe(handleDELETE);
