import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { openRows, sealText } from '@/lib/societyCrypto';
import { lockSafe } from '@/lib/lockSafe';
import { projectContext, readGroup } from '@/lib/projects';
import { plainText, taskAccess, UUID_RE } from '@/lib/tasks';

type Params = { params: Promise<{ id: string; tid: string }> };

// POST { projectId, groupId?, newGroup? } — the author turns their task into a
// Project Task (they must be the project's manager or a moderator). Title,
// description, status, due date and their categories go with it, notes become
// its comments, and the author is assigned. The task leaves the Tasks list.
async function handlePOST(req: NextRequest, { params }: Params) {
  const { id, tid } = await params;
  const r = await taskAccess(req, id);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const { a } = r;
  if (!UUID_RE.test(tid)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { rows: [t] } = await pool.query(
    `SELECT id, owner_id, name, description, notes, status, to_char(due_date, 'YYYY-MM-DD') AS due_date
     FROM society_tasks WHERE id = $1 AND customer_id = $2 AND deleted_at IS NULL`, [tid, a.societyId]);
  if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (t.owner_id !== a.me) return NextResponse.json({ error: 'Only the task’s author can convert it' }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  if (typeof b.projectId !== 'string') return NextResponse.json({ error: 'Choose a project' }, { status: 400 });
  const c = await projectContext(req, id, b.projectId);
  if (!c) return NextResponse.json({ error: 'That project wasn’t found' }, { status: 404 });
  if (!c.canManage) return NextResponse.json({ error: 'Only that project’s manager or a Society Admin can add tasks to it' }, { status: 403 });
  if (c.sealed) return NextResponse.json({ error: 'Tasks can’t be converted into a sealed project yet. Add it there by hand.' }, { status: 409 });
  if (c.project.status === 'complete') return NextResponse.json({ error: 'That project is complete' }, { status: 409 });
  const group = await readGroup(c.project.id, a.societyId, a.me, b, c);
  if (group && 'error' in group) return NextResponse.json({ error: group.error }, { status: 404 });

  await openRows(a.societyId, [t], ['name', 'description', 'notes']);
  const client = await pool.connect();
  let ptid: string;
  try {
    await client.query('BEGIN');
    ({ rows: [{ id: ptid }] } = await client.query(
      `INSERT INTO project_tasks (project_id, parent_id, sort_order, name, description, due_date, status, comments, created_by, group_id)
       VALUES ($1, NULL, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM project_tasks WHERE project_id = $1 AND parent_id IS NULL),
               $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [c.project.id, await sealText(a.societyId, t.name.slice(0, 200)), await sealText(a.societyId, plainText(t.description)?.slice(0, 5000) ?? null),
       t.due_date, t.status, await sealText(a.societyId, plainText(t.notes)?.slice(0, 5000) ?? null), a.me, group?.id ?? null]));
    await client.query('INSERT INTO project_task_assignees (task_id, user_id, assigned_by) VALUES ($1, $2, $2) ON CONFLICT DO NOTHING', [ptid, a.me]);
    await client.query('UPDATE task_category_links SET project_task_id = $1, task_id = NULL WHERE task_id = $2', [ptid, tid]);
    await client.query('UPDATE society_tasks SET converted_to = $1, deleted_at = now(), updated_at = now() WHERE id = $2', [ptid, tid]);
    await client.query('DELETE FROM task_shares WHERE task_id = $1', [tid]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  return NextResponse.json({ projectId: c.project.id, projectTaskId: ptid }, { status: 201 });
}

export const POST = lockSafe(handlePOST);
