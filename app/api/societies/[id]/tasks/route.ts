import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { openRows, sealText } from '@/lib/societyCrypto';
import { lockSafe } from '@/lib/lockSafe';
import {
  canSeeSql, memberIds, priorityId, myCategories, ownCategoryIds, priorities, QUICK_STATUSES, readDate, readRich, setMyCategories,
  taskAccess, TITLE_MAX,
} from '@/lib/tasks';

type Params = { params: Promise<{ id: string }> };

// GET — everything the Tasks list needs: this member's tasks and the ones shared
// with them, the Society's Project Tasks (sealed projects' text arrives sealed,
// for the browser to open), the Society's priorities and this member's categories.
export async function GET(req: NextRequest, { params }: Params) {
  const r = await taskAccess(req, (await params).id);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const { a } = r;
  const [prios, cats, tasks, ptasks] = await Promise.all([
    priorities(a.societyId),
    myCategories(a.societyId, a.me),
    pool.query(
      `SELECT t.id, t.number, t.name, t.description, t.notes, t.status, t.priority_id, t.shared_all,
              to_char(t.due_date, 'YYYY-MM-DD') AS due_date, t.created_at, t.updated_at, t.completed_at,
              t.owner_id = $2 AS mine, u.user_handle AS owner,
              CASE WHEN t.owner_id = $2 THEN COALESCE((SELECT json_agg(json_build_object('id', su.id, 'handle', su.user_handle) ORDER BY su.user_handle)
                FROM task_shares s JOIN users su ON su.id = s.user_id WHERE s.task_id = t.id), '[]') END AS shares,
              COALESCE((SELECT json_agg(l.category_id) FROM task_category_links l JOIN task_categories c ON c.id = l.category_id
                        WHERE l.task_id = t.id AND c.owner_id = $2), '[]') AS categories
       FROM society_tasks t LEFT JOIN users u ON u.id = t.owner_id
       WHERE t.customer_id = $1 AND t.deleted_at IS NULL AND ${canSeeSql('$2')}
       ORDER BY t.number`,
      [a.societyId, a.me]),
    a.session && !(await disabled(a.societyId, 'projects')) ? pool.query(
      `SELECT t.id, t.project_id, p.name AS project, p.protection, t.name, t.description, t.comments, t.status,
              to_char(COALESCE(t.due_date, t.end_date), 'YYYY-MM-DD') AS due_date, t.created_at, t.updated_at,
              EXISTS (SELECT 1 FROM project_task_assignees x WHERE x.task_id = t.id AND x.user_id = $2) AS assigned_to_me,
              COALESCE((SELECT json_agg(json_build_object('id', u.id, 'handle', u.user_handle) ORDER BY u.user_handle)
                        FROM project_task_assignees x JOIN users u ON u.id = x.user_id WHERE x.task_id = t.id), '[]') AS assignees,
              COALESCE((SELECT json_agg(l.category_id) FROM task_category_links l JOIN task_categories c ON c.id = l.category_id
                        WHERE l.project_task_id = t.id AND c.owner_id = $2), '[]') AS categories
       FROM project_tasks t JOIN projects p ON p.id = t.project_id
       WHERE p.customer_id = $1 AND p.deleted_at IS NULL
       ORDER BY p.created_at, t.sort_order LIMIT 3000`,
      [a.societyId, a.me]) : { rows: [] },
  ]);
  // Projects this member could convert a task into (they manage it, or moderate the Society)
  const projectsOn = !(await disabled(a.societyId, 'projects'));
  const targets = !projectsOn ? [] : (await pool.query(
    `SELECT p.id, p.name,
            COALESCE((SELECT json_agg(json_build_object('id', g.id, 'name', g.name) ORDER BY g.sort_order, g.created_at)
                      FROM project_task_groups g WHERE g.project_id = p.id), '[]') AS groups
     FROM projects p
     WHERE p.customer_id = $1 AND p.deleted_at IS NULL AND p.status <> 'complete' AND p.protection <> 'sealed'
       AND (p.manager_id = $2 OR $3)
     ORDER BY p.created_at DESC`,
    [a.societyId, a.me, a.canModerate])).rows;
  await openRows(a.societyId, targets, ['name']);
  for (const p of targets) await openRows(a.societyId, p.groups, ['name']);
  await openRows(a.societyId, tasks.rows, ['name', 'description', 'notes']);
  await openRows(a.societyId, ptasks.rows, ['project', 'name', 'description', 'comments']);
  const res = NextResponse.json({
    me: a.me, priorities: prios, categories: cats, canManagePriorities: a.canModerate,
    // Moderators managing priorities see how many tasks use each (counts only, every member's tasks)
    priorityCounts: a.canModerate ? Object.fromEntries((await pool.query(
      `SELECT priority_id, count(*)::int AS n, count(*) FILTER (WHERE status <> 'complete')::int AS open
       FROM society_tasks WHERE customer_id = $1 AND deleted_at IS NULL AND priority_id IS NOT NULL GROUP BY priority_id`,
      [a.societyId])).rows.map(r => [r.priority_id, { n: r.n, open: r.open }])) : undefined,
    tasks: tasks.rows, projectTasks: ptasks.rows, convertTargets: targets, projectsOn,
  });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

async function disabled(societyId: number, feature: string) {
  const { rows: [c] } = await pool.query('SELECT disabled_sections FROM customers WHERE id = $1', [societyId]);
  return Array.isArray(c?.disabled_sections) && c.disabled_sections.includes(feature);
}

// POST { name, description?, notes?, status?, priorityId?, dueDate?, categoryIds?, sharedAll?, shareWith? }
async function handlePOST(req: NextRequest, { params }: Params) {
  const r = await taskAccess(req, (await params).id);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const { a } = r;
  const b = await req.json().catch(() => ({}));
  const name = typeof b.name === 'string' && b.name.trim() ? b.name.trim().slice(0, TITLE_MAX) : null;
  if (!name) return NextResponse.json({ error: 'Give the task a title' }, { status: 400 });
  const description = readRich(b.description), notes = readRich(b.notes);
  if (description === undefined && b.description !== undefined || notes === undefined && b.notes !== undefined) {
    return NextResponse.json({ error: 'The description or notes are too long' }, { status: 413 });
  }
  const status = (QUICK_STATUSES as readonly string[]).includes(b.status) ? b.status : 'new';
  const due = readDate(b.dueDate);
  if (due === undefined && b.dueDate) return NextResponse.json({ error: 'That date wasn’t understood' }, { status: 400 });
  const priority = await priorityId(a.societyId, b.priorityId);
  if (priority === false) return NextResponse.json({ error: 'That priority wasn’t found' }, { status: 400 });
  const cats = await ownCategoryIds(a.societyId, a.me, b.categoryIds) ?? [];
  const shareWith = await memberIds(a.societyId, a.me, b.shareWith) ?? [];

  const client = await pool.connect();
  let id: string, number: number;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`society_tasks:${a.societyId}`]);
    ({ rows: [{ id, number }] } = await client.query(
      `INSERT INTO society_tasks (customer_id, number, owner_id, name, description, notes, status, priority_id, due_date, shared_all, completed_at)
       VALUES ($1, (SELECT COALESCE(MAX(number), 0) + 1 FROM society_tasks WHERE customer_id = $1), $2, $3, $4, $5, $6, $7, $8, $9,
               CASE WHEN $6 = 'complete' THEN now() END)
       RETURNING id, number`,
      [a.societyId, a.me, await sealText(a.societyId, name, true), await sealText(a.societyId, description ?? null, true),
       await sealText(a.societyId, notes ?? null, true), status, priority, due ?? null, b.sharedAll === true]));
    for (const u of shareWith) await client.query('INSERT INTO task_shares (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, u]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  if (cats.length) await setMyCategories(a.me, { taskId: id }, cats);
  return NextResponse.json({ id, number }, { status: 201 });
}

export const POST = lockSafe(handlePOST);
