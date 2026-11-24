import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { openRows, sealText } from '@/lib/societyCrypto';
import { checkDeps, projectContext, readDate, readDeps, readDocumentId, readGroup, saveDeps, text, TASK_STATUSES, UUID_RE, ptext } from '@/lib/projects';
import { openText } from '@/lib/societyCrypto';
import { RICH_MAX } from '@/lib/tasks';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string; pid: string; tid: string }> };

async function loadTask(projectId: string, taskId: string) {
  if (!UUID_RE.test(taskId)) return null;
  const { rows: [t] } = await pool.query(
    `SELECT t.id, t.parent_id, t.group_id, t.name, to_char(t.start_date, 'YYYY-MM-DD') AS start_date, to_char(t.end_date, 'YYYY-MM-DD') AS end_date,
            to_char(t.due_date, 'YYYY-MM-DD') AS due_date,
            COALESCE((SELECT json_agg(json_build_object('task_id', d.depends_on, 'kind', d.kind)) FROM project_task_deps d WHERE d.task_id = t.id), '[]') AS deps
     FROM project_tasks t WHERE t.id = $1 AND t.project_id = $2`,
    [taskId, projectId],
  );
  return t ?? null;
}

// PATCH — the PM or a moderator edits any field; members allocated to the
// task can update its status and comments.
async function handlePATCH(req: NextRequest, { params }: Params) {
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
  const seal = (v: string | null) => sealText(c.a.societyId, v);
  if ('comments' in b) set('comments', await seal(ptext(c, b.comments, 5000)));
  if (c.canManage) {
    if ('name' in b) { const n = ptext(c, b.name, 200); if (!n) return NextResponse.json({ error: 'A project task name is required' }, { status: 400 }); set('name', await seal(n)); }
    if ('description' in b) set('description', await seal(ptext(c, b.description, RICH_MAX)));
    const start = readDate(b.startDate), end = readDate(b.endDate), due = readDate(b.dueDate);
    const doc = await readDocumentId(c.a.societyId, b.documentId);
    if (doc === false) return NextResponse.json({ error: 'That document was not found' }, { status: 404 });
    if (doc !== undefined) set('document_id', doc);
    if (start !== undefined) set('start_date', start);
    if (end !== undefined) set('end_date', end);
    if (due !== undefined) set('due_date', due);
    const s = start !== undefined ? start : task.start_date, e = end !== undefined ? end : task.end_date;
    if (s && e && e < s) return NextResponse.json({ error: 'The project task must end after it starts' }, { status: 400 });
    // Its dependencies, new or existing, must agree with its (new) dates
    const deps = readDeps(b.dependencies);
    if (deps === false) return NextResponse.json({ error: 'Those dependencies weren’t understood' }, { status: 400 });
    if (deps !== undefined || start !== undefined || end !== undefined || due !== undefined) {
      const name = 'name' in b && ptext(c, b.name, 200) ? ptext(c, b.name, 200)! : await openText(c.a.societyId, task.name as string);
      const depError = await checkDeps(pid, tid, task.parent_id, name, deps ?? task.deps,
        { start_date: s, end_date: e, due_date: due !== undefined ? due : task.due_date });
      if (depError) return NextResponse.json({ error: depError }, { status: 400 });
    }
    if (deps !== undefined) await saveDeps(tid, deps);
    // Top-level tasks go in a group; sub-tasks stay with their parent
    if (!task.parent_id) {
      const group = await readGroup(pid, c.a.societyId, c.me, b, c);
      if (group && 'error' in group) return NextResponse.json({ error: group.error }, { status: 404 });
      if (group) set('group_id', group.id);
    }
    if (b.move === 'up' || b.move === 'down') {
      // Among its siblings: same parent, and for top-level tasks the same group
      const { rows: [me] } = await pool.query('SELECT parent_id, group_id, sort_order FROM project_tasks WHERE id = $1', [tid]);
      const { rows: [other] } = await pool.query(
        `SELECT id, sort_order FROM project_tasks WHERE project_id = $1 AND parent_id IS NOT DISTINCT FROM $2
           AND ($2::uuid IS NOT NULL OR group_id IS NOT DISTINCT FROM $4::uuid)
           AND sort_order ${b.move === 'up' ? '<' : '>'} $3 ORDER BY sort_order ${b.move === 'up' ? 'DESC' : 'ASC'} LIMIT 1`,
        [pid, me.parent_id, me.sort_order, me.group_id]);
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
async function handleDELETE(req: NextRequest, { params }: Params) {
  const { id, pid, tid } = await params;
  const c = await projectContext(req, id, pid);
  const task = c ? await loadTask(pid, tid) : null;
  if (!c || !task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!c.canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await pool.query('DELETE FROM project_tasks WHERE id = $1', [tid]);
  return NextResponse.json({ ok: true });
}

export const PATCH = lockSafe(handlePATCH);
export const DELETE = lockSafe(handleDELETE);
