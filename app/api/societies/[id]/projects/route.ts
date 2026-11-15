import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { isSocietyMember, readDate, text, UUID_RE } from '@/lib/projects';

type Params = { params: Promise<{ id: string }> };

// GET — the Society's projects with progress.
export async function GET(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.description, p.status,
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
  return NextResponse.json({ projects: rows, canCreate: a.canModerate });
}

// POST { name, description?, managerId?, startDate?, endDate? } — moderators create a project.
export async function POST(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Only moderators can create projects' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const name = text(b.name, 200);
  if (!name) return NextResponse.json({ error: 'A project name is required' }, { status: 400 });
  let manager: string | null = null;
  if (typeof b.managerId === 'string' && UUID_RE.test(b.managerId)) {
    if (!await isSocietyMember(a.societyId, b.managerId)) return NextResponse.json({ error: 'The Project Manager must be a member of this Society' }, { status: 400 });
    manager = b.managerId;
  }
  const start = readDate(b.startDate) ?? null, end = readDate(b.endDate) ?? null;
  if (start && end && end < start) return NextResponse.json({ error: 'The project must end after it starts' }, { status: 400 });
  const { rows: [p] } = await pool.query(
    `INSERT INTO projects (customer_id, name, description, manager_id, start_date, end_date, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [a.societyId, name, text(b.description, 5000), manager, start, end, a.session!.sub],
  );
  return NextResponse.json({ id: p.id }, { status: 201 });
}
