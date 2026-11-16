import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { parseTime, readEvent } from '@/lib/events';
import { openRows, sealText } from '@/lib/societyCrypto';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string }> };

// GET ?from=&to= — events overlapping the range (default: this month ± a week).
// Project tasks appear on their due date (or end date if no due date).
export async function GET(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const now = new Date();
  const from = parseTime(req.nextUrl.searchParams.get('from')) ?? new Date(now.getFullYear(), now.getMonth(), -7);
  const to = parseTime(req.nextUrl.searchParams.get('to')) ?? new Date(now.getFullYear(), now.getMonth() + 1, 7);
  const { rows: events } = await pool.query(
    `SELECT e.id, e.title, e.description, e.location, e.starts_at, e.ends_at, e.all_day, u.user_handle AS created_by_handle
     FROM society_events e LEFT JOIN users u ON u.id = e.created_by
     WHERE e.customer_id = $1 AND e.deleted_at IS NULL
       AND e.starts_at < $3
       -- an all-day event lasts until the end of its last day
       AND COALESCE(e.ends_at, e.starts_at) + CASE WHEN e.all_day THEN interval '1 day' ELSE interval '0' END > $2
     ORDER BY e.starts_at`,
    [a.societyId, from, to],
  );
  const { rows: tasks } = await pool.query(
    `SELECT t.id, t.name AS title, p.name AS project, p.id AS project_id, t.status,
            to_char(COALESCE(t.due_date, t.end_date), 'YYYY-MM-DD') AS due_at
     FROM project_tasks t JOIN projects p ON p.id = t.project_id
     WHERE p.customer_id = $1 AND p.deleted_at IS NULL
       AND COALESCE(t.due_date, t.end_date) BETWEEN $2::date AND $3::date
     ORDER BY COALESCE(t.due_date, t.end_date)`,
    [a.societyId, from, to],
  );
  await openRows(a.societyId, events, ['title', 'description', 'location']);
  await openRows(a.societyId, tasks, ['title', 'project']);
  const STATUS: Record<string, string> = { new: 'New', in_progress: 'In progress', complete: 'Complete' };
  return NextResponse.json({
    events,
    tasks: tasks.map(t => ({ ...t, status: STATUS[t.status] ?? t.status, href: `/society/${a.societyId}/projects/${t.project_id}` })),
    canModerate: a.canModerate,
  });
}

// POST — moderators add an event.
async function handlePOST(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Only moderators can add events' }, { status: 403 });
  const e = readEvent(await req.json().catch(() => ({})));
  if (!e.ok) return NextResponse.json({ error: e.error }, { status: 400 });
  const { rows: [row] } = await pool.query(
    `INSERT INTO society_events (customer_id, title, description, location, starts_at, ends_at, all_day, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [a.societyId, await sealText(a.societyId, e.title), await sealText(a.societyId, e.description), await sealText(a.societyId, e.location), e.startsAt, e.endsAt, e.allDay, a.session!.sub],
  );
  return NextResponse.json({ id: row.id }, { status: 201 });
}

export const POST = lockSafe(handlePOST);
