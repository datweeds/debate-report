import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { projectContext, readDate, text, TASK_STATUSES, UUID_RE } from '@/lib/projects';

type Params = { params: Promise<{ id: string; pid: string; tid: string }> };

async function loadTask(projectId: string, taskId: string) {
  if (!UUID_RE.test(taskId)) return null;
  const { rows: [t] } = await pool.query(
    `SELECT t.id, to_char(t.start_date, 'YYYY-MM-DD') AS start_date, to_char(t.end_date, 'YYYY-MM-DD') AS end_date
     FROM project_tasks t WHERE t.id = $1 AND t.project_id = $2`,
    [taskId, projectId],
  );
  return t ?? null;
}

// PATCH — the PM or a moderator edits any field; members allocated to the
// task can update its status and comments.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, pid, tid } = await params;
  const c = await projectContext(req, id, pid);
  const task = c ? await loadTask(pid, tid) : null;
  if (!c || !task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { rows } = c.me ? await pool.query('SELECT 1 FROM project_task_assignees WHERE task_id = $1 AND user_id = $2', [tid, c.me]) : { rows: [] };
  const allocated = rows.length > 0;
  if (!c.canManage && !allocated) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const sets: string[] = []; const vals: unknown[] = [];
  const set = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
  if ('status' in b) {
    if (!(TASK_STATUSES as readonly string[]).includes(b.status)) return NextResponse.json({ error: 'Unknown status' }, { status: 400 });
    set('status', b.status);
  }
  if ('comments' in b) set('comments', text(b.comments, 5000));
  if (c.canManage) {
    if ('name' in b) { const n = text(b.name, 200); if (!n) return NextResponse.json({ error: 'A task name is required' }, { status: 400 }); set('name', n); }
    if ('description' in b) set('description', text(b.description, 5000));
    const start = readDate(b.startDate), end = readDate(b.endDate), due = readDate(b.dueDate);
    if (start !== undefined) set('start_date', start);
    if (end !== undefined) set('end_date', end);
    if (due !== undefined) set('due_date', due);
    const s = start !== undefined ? start : task.start_date, e = end !== undefined ? end : task.end_date;
    if (s && e && e < s) return NextResponse.json({ error: 'The task must end after it starts' }, { status: 400 });
    if (b.move === 'up' || b.move === 'down') {
      const { rows: [me] } = await pool.query('SELECT parent_id, sort_order FROM project_tasks WHERE id = $1', [tid]);
      const { rows: [other] } = await pool.query(
        `SELECT id, sort_order FROM project_tasks WHERE project_id = $1 AND parent_id IS NOT DISTINCT FROM $2
           AND sort_order ${b.move === 'up' ? '<' : '>'} $3 ORDER BY sort_order ${b.move === 'up' ? 'DESC' : 'ASC'} LIMIT 1`,
        [pid, me.parent_id, me.sort_order]);
      if (other) {
        await pool.query('UPDATE project_tasks SET sort_order = $1 WHERE id = $2', [other.sort_order, tid]);
        await pool.query('UPDATE project_tasks SET sort_order = $1 WHERE id = $2', [me.sort_order, other.id]);
      }
    }
  }
  if (sets.length) {
    vals.push(tid);
    await pool.query(`UPDATE project_tasks SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}`, vals);
  }
  return NextResponse.json({ ok: true });
}

// DELETE — the PM or a moderator; its sub-tasks and reports go with it.
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id, pid, tid } = await params;
  const c = await projectContext(req, id, pid);
  const task = c ? await loadTask(pid, tid) : null;
  if (!c || !task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!c.canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await pool.query('DELETE FROM project_tasks WHERE id = $1', [tid]);
  return NextResponse.json({ ok: true });
}
