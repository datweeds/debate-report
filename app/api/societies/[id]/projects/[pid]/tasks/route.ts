import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { openRows, sealText } from '@/lib/societyCrypto';
import { checkDeps, projectContext, readDate, readDeps, readDocumentId, readGroup, saveDeps, text, TASK_STATUSES, UUID_RE, ptext } from '@/lib/projects';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string; pid: string }> };

// POST { name, parentId?, description?, startDate?, endDate?, dueDate?, status?, comments?, documentId?,
//        dependencies?: [{ taskId, kind: 'finish' | 'start' }], groupId?, newGroup? (a new group's name) }
// — the PM or a moderator adds a task (or a sub-task under parentId).
async function handlePOST(req: NextRequest, { params }: Params) {
  const { id, pid } = await params;
  const c = await projectContext(req, id, pid);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!c.canManage) return NextResponse.json({ error: 'Only the Project Manager or a Society Admin can add project tasks' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const name = ptext(c, b.name, 200);
  if (!name) return NextResponse.json({ error: 'A project task name is required' }, { status: 400 });
  let parent: string | null = null;
  if (b.parentId) {
    if (typeof b.parentId !== 'string' || !UUID_RE.test(b.parentId)) return NextResponse.json({ error: 'Parent project task not found' }, { status: 404 });
    const { rows } = await pool.query('SELECT 1 FROM project_tasks WHERE id = $1 AND project_id = $2', [b.parentId, pid]);
    if (!rows.length) return NextResponse.json({ error: 'Parent project task not found' }, { status: 404 });
    parent = b.parentId;
  }
  // The due date defaults to the end date
  const start = readDate(b.startDate) ?? null, end = readDate(b.endDate) ?? null, due = readDate(b.dueDate) ?? end;
  if (start && end && end < start) return NextResponse.json({ error: 'The project task must end after it starts' }, { status: 400 });
  const status = (TASK_STATUSES as readonly string[]).includes(b.status) ? b.status : 'new';
  const doc = await readDocumentId(c.a.societyId, b.documentId);
  if (doc === false) return NextResponse.json({ error: 'That document was not found' }, { status: 404 });
  const deps = readDeps(b.dependencies);
  if (deps === false) return NextResponse.json({ error: 'Those dependencies weren’t understood' }, { status: 400 });
  const depError = await checkDeps(pid, null, parent, name, deps ?? [], { start_date: start, end_date: end, due_date: due });
  if (depError) return NextResponse.json({ error: depError }, { status: 400 });
  // Top-level tasks go in a group; sub-tasks stay with their parent
  const group = parent ? undefined : await readGroup(pid, c.a.societyId, c.me, b, c);
  if (group && 'error' in group) return NextResponse.json({ error: group.error }, { status: 404 });
  const { rows: [t] } = await pool.query(
    `INSERT INTO project_tasks (project_id, parent_id, sort_order, name, description, start_date, end_date, due_date, status, comments, created_by, document_id, group_id)
     VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM project_tasks WHERE project_id = $1 AND parent_id IS NOT DISTINCT FROM $2),
             $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id`,
    [pid, parent, await sealText(c.a.societyId, name), await sealText(c.a.societyId, ptext(c, b.description, 5000)), start, end, due, status,
     await sealText(c.a.societyId, ptext(c, b.comments, 5000)), c.me, doc ?? null, group?.id ?? null],
  );
  if (deps?.length) await saveDeps(t.id, deps);
  return NextResponse.json({ id: t.id }, { status: 201 });
}

export const POST = lockSafe(handlePOST);
