import { NextRequest, NextResponse } from 'next/server';
import { notifyNew } from '@/lib/notify';
import pool from '@/lib/db';
import { openRows, sealText } from '@/lib/societyCrypto';
import { societyContentAccess } from '@/lib/societies';
import { isSocietyMember, ptext, readDate, UUID_RE } from '@/lib/projects';
import { allowsSealed, firstLocks, readLocks } from '@/lib/sealed/server';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string }> };

// GET — the Society's projects with progress.
export async function GET(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.description, p.status, p.protection,
            to_char(p.start_date, 'YYYY-MM-DD') AS start_date, to_char(p.end_date, 'YYYY-MM-DD') AS end_date,
            m.user_handle AS manager,
            COUNT(t.id)::int AS task_count,
            COUNT(t.id) FILTER (WHERE t.status = 'complete')::int AS done_count,
            COUNT(t.id) FILTER (WHERE t.status <> 'complete' AND t.due_date < CURRENT_DATE)::int AS overdue_count,
            (SELECT COUNT(*)::int FROM project_raid r WHERE r.project_id = p.id AND r.status = 'open') AS open_raid
     FROM projects p
     LEFT JOIN users m ON m.id = p.manager_id
     LEFT JOIN project_tasks t ON t.project_id = p.id
     WHERE p.customer_id = $1 AND p.deleted_at IS NULL
     GROUP BY p.id, m.user_handle
     ORDER BY (p.status = 'complete'), p.created_at DESC`,
    [a.societyId],
  );
  await openRows(a.societyId, rows, ['name', 'description']);
  return NextResponse.json({ projects: rows, canCreate: a.canModerate, allowSealed: a.isMember && await allowsSealed(a.societyId) });
}

// POST { name, description?, managerId?, startDate?, endDate? } — moderators create a project.
async function handlePOST(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Only moderators can create projects' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  // Sealed: { protection: 'sealed', id, name, description (sealed in the browser), locks }
  const sealed = b.protection === 'sealed';
  let item: { type: 'project'; id: string; societyId: number; epoch: number } | null = null;
  if (sealed) {
    if (!a.isMember || !await allowsSealed(a.societyId)) return NextResponse.json({ error: 'This Society doesn’t allow Sealed projects' }, { status: 403 });
    if (typeof b.id !== 'string' || !UUID_RE.test(b.id) || !readLocks(b.locks)) return NextResponse.json({ error: 'That sealed project wasn’t understood' }, { status: 400 });
    item = { type: 'project', id: b.id, societyId: a.societyId, epoch: 1 };
  }
  const name = ptext({ sealed: item }, b.name, 200);
  if (!name) return NextResponse.json({ error: 'A project name is required' }, { status: 400 });
  const description = ptext({ sealed: item }, b.description, 5000);
  let manager: string | null = null;
  if (typeof b.managerId === 'string' && UUID_RE.test(b.managerId)) {
    if (!await isSocietyMember(a.societyId, b.managerId)) return NextResponse.json({ error: 'The Project Manager must be a member of this Society' }, { status: 400 });
    manager = b.managerId;
  }
  const start = readDate(b.startDate) ?? null, end = readDate(b.endDate) ?? null;
  if (start && end && end < start) return NextResponse.json({ error: 'The project must end after it starts' }, { status: 400 });
  const client = await pool.connect();
  let p: { id: string };
  try {
    await client.query('BEGIN');
    ({ rows: [p] } = await client.query(
      `INSERT INTO projects (id, customer_id, name, description, manager_id, start_date, end_date, created_by, protection, sealed_epoch)
       VALUES (COALESCE($9::uuid, gen_random_uuid()), $1, $2, $3, $4, $5, $6, $7, $8, $10) RETURNING id`,
      [a.societyId, await sealText(a.societyId, name), await sealText(a.societyId, description), manager, start, end, a.session!.sub,
       sealed ? 'sealed' : 'server', item?.id ?? null, sealed ? 1 : null],
    ));
    if (item) {
      const problem = await firstLocks(client, item, a.session!.sub, readLocks(b.locks)!);
      if (problem) { await client.query('ROLLBACK'); return NextResponse.json({ error: problem }, { status: 400 }); }
    }
    await client.query('COMMIT');
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  notifyNew({ societyId: a.societyId, kind: 'projects', authorId: a.session!.sub, title: name, url: `/society/${a.societyId}/projects/${p.id}` });
  return NextResponse.json({ id: p.id }, { status: 201 });
}

export const POST = lockSafe(handlePOST);
