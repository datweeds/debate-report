import { NextRequest, NextResponse } from 'next/server';
import { notifyNew } from '@/lib/notify';
import pool from '@/lib/db';
import { projectContext, UUID_RE } from '@/lib/projects';

type Params = { params: Promise<{ id: string; pid: string; tid: string }> };

// PUT { userIds } — the PM or a moderator sets who is allocated to a task.
// Only members of the Society can be allocated.
export async function PUT(req: NextRequest, { params }: Params) {
  const { id, pid, tid } = await params;
  const c = await projectContext(req, id, pid);
  if (!c || !UUID_RE.test(tid)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!c.canManage) return NextResponse.json({ error: 'Only the Project Manager or a moderator can allocate tasks' }, { status: 403 });
  const { rows: [t] } = await pool.query('SELECT 1 FROM project_tasks WHERE id = $1 AND project_id = $2', [tid, pid]);
  if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { userIds } = await req.json().catch(() => ({}));
  if (!Array.isArray(userIds) || !userIds.every(u => typeof u === 'string' && UUID_RE.test(u))) {
    return NextResponse.json({ error: 'userIds must be a list of members' }, { status: 400 });
  }
  const { rows: members } = await pool.query(
    `SELECT u.id FROM users u WHERE u.id = ANY($2::uuid[]) AND u.id::text IN (
       SELECT user_id FROM customer_members WHERE customer_id = $1
       UNION SELECT user_id FROM customer_roles WHERE tenant_id = $1 AND role = 'customer_admin')`,
    [c.a.societyId, userIds],
  );
  if (members.length !== new Set(userIds).size) {
    return NextResponse.json({ error: 'Only members of this Society can be allocated' }, { status: 400 });
  }
  const { rows: before } = await pool.query('SELECT user_id::text AS id FROM project_task_assignees WHERE task_id = $1', [tid]);
  const added = [...new Set(userIds as string[])].filter(id => !before.some(b => b.id === id));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM project_task_assignees WHERE task_id = $1 AND NOT (user_id = ANY($2::uuid[]))', [tid, userIds]);
    await client.query(
      `INSERT INTO project_task_assignees (task_id, user_id, assigned_by)
       SELECT $1, u, $3 FROM unnest($2::uuid[]) u ON CONFLICT DO NOTHING`, [tid, userIds, c.me]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  if (added.length) notifyNew({
    societyId: c.a.societyId, kind: 'projects', authorId: c.me, to: added, private: true,
    heading: 'You’ve been given a task in {society}',
    url: `/society/${c.a.societyId}/projects/${pid}`,
  });
  return NextResponse.json({ ok: true });
}
