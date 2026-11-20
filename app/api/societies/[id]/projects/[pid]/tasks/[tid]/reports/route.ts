import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { openRows, sealText } from '@/lib/societyCrypto';
import { projectContext, text, TASK_STATUSES, UUID_RE, ptext } from '@/lib/projects';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string; pid: string; tid: string }> };

async function taskInProject(pid: string, tid: string) {
  if (!UUID_RE.test(tid)) return null;
  const { rows: [t] } = await pool.query('SELECT id, status FROM project_tasks WHERE id = $1 AND project_id = $2', [tid, pid]);
  return t ?? null;
}

// GET — every status report on the task, newest first (the drill-down).
export async function GET(req: NextRequest, { params }: Params) {
  const { id, pid, tid } = await params;
  const c = await projectContext(req, id, pid);
  if (!c || !await taskInProject(pid, tid)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { rows } = await pool.query(
    `SELECT r.id, r.status, r.body, r.created_at, u.user_handle AS by
     FROM project_status_reports r LEFT JOIN users u ON u.id = r.user_id
     WHERE r.task_id = $1 ORDER BY r.created_at DESC`, [tid]);
  await openRows(c.a.societyId, rows, ['body']);
  return NextResponse.json({ reports: rows });
}

// POST { body, status? } — a member allocated to the task (or the PM / a
// moderator) files a status report, optionally updating the task's status.
async function handlePOST(req: NextRequest, { params }: Params) {
  const { id, pid, tid } = await params;
  const c = await projectContext(req, id, pid);
  const task = c ? await taskInProject(pid, tid) : null;
  if (!c || !task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { rows } = c.me ? await pool.query('SELECT 1 FROM project_task_assignees WHERE task_id = $1 AND user_id = $2', [tid, c.me]) : { rows: [] };
  if (!rows.length && !c.canManage) return NextResponse.json({ error: 'Only people allocated to this project task can report on it' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const body = ptext(c, b.body, 5000);
  if (!body) return NextResponse.json({ error: 'Write the status update' }, { status: 400 });
  const status = (TASK_STATUSES as readonly string[]).includes(b.status) ? b.status : task.status;
  await pool.query('INSERT INTO project_status_reports (task_id, user_id, status, body) VALUES ($1, $2, $3, $4)', [tid, c.me, status, await sealText(c.a.societyId, body)]);
  if (status !== task.status) await pool.query('UPDATE project_tasks SET status = $1, updated_at = now() WHERE id = $2', [status, tid]);
  return NextResponse.json({ ok: true }, { status: 201 });
}

export const POST = lockSafe(handlePOST);
