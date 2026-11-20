import { NextRequest, NextResponse } from 'next/server';
import { notifyNew } from '@/lib/notify';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { parseTime, readEvent } from '@/lib/events';
import { hideEndToEnd, openRows, sealText } from '@/lib/societyCrypto';
import { lockSafe } from '@/lib/lockSafe';
import { allowsSealed, sealedFor, sealedSection } from '@/lib/sealed/server';
import { responsesFor } from '@/lib/eventResponses';

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
    `SELECT e.id, e.title, e.description, e.location, e.starts_at, e.ends_at, e.all_day, u.user_handle AS created_by_handle,
            e.created_by, e.response_visibility
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
  // Quick tasks this member may see (their own, or shared with them), on their due date
  const me = a.session?.sub ?? null;
  const { rows: quick } = me && a.isMember ? await pool.query(
    `SELECT t.id, t.name AS title, NULL AS project, t.status, to_char(t.due_date, 'YYYY-MM-DD') AS due_at, t.number
     FROM society_tasks t
     WHERE t.customer_id = $1 AND t.deleted_at IS NULL AND t.due_date BETWEEN $2::date AND $3::date
       AND (t.owner_id = $4 OR t.shared_all OR EXISTS (SELECT 1 FROM task_shares s WHERE s.task_id = t.id AND s.user_id = $4))
     ORDER BY t.due_date`,
    [a.societyId, from, to, me]) : { rows: [] };
  await openRows(a.societyId, quick, ['title']);
  await openRows(a.societyId, events, ['title', 'description', 'location']);
  // Members' responses, as much as this viewer may see; the author's id stays on the server
  const responses = await responsesFor(events, { me, isMember: a.isMember, canModerate: a.canModerate });
  for (const e of events) { e.responses = responses.get(e.id) ?? null; delete e.created_by; }
  await openRows(a.societyId, tasks, ['title', 'project']);
  // Sealed projects' task names can't be read here: show them as sealed
  await hideEndToEnd(tasks);
  const STATUS: Record<string, string> = { new: 'New', in_progress: 'In progress', paused: 'Paused', complete: 'Complete' };
  // A sealed calendar's text arrives encrypted; members' browsers open it
  const sealed = await sealedSection(a.societyId, 'calendar');
  return NextResponse.json({
    sealed: sealed ? { id: sealed.id, epoch: sealed.epoch } : null,
    canSeal: a.canModerate && a.isMember && await allowsSealed(a.societyId),
    events,
    tasks: [
      ...tasks.map(t => ({ ...t, kind: 'project', status: STATUS[t.status] ?? t.status, href: `/society/${a.societyId}/projects/${t.project_id}` })),
      ...quick.map(t => ({ ...t, kind: 'task', project: `T-${String(t.number).padStart(4, '0')}`, status: STATUS[t.status] ?? t.status, href: `/society/${a.societyId}/tasks?task=${t.id}` })),
    ],
    canModerate: a.canModerate,
  });
}

// POST — moderators add an event.
async function handlePOST(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Only moderators can add events' }, { status: 403 });
  const sealed = await sealedSection(a.societyId, 'calendar');
  const e = readEvent(await req.json().catch(() => ({})), sealed ? v => sealedFor(sealed, v, 30000) : undefined);
  if (!e.ok) return NextResponse.json({ error: e.error }, { status: 400 });
  const { rows: [row] } = await pool.query(
    `INSERT INTO society_events (customer_id, title, description, location, starts_at, ends_at, all_day, created_by, response_visibility)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [a.societyId, await sealText(a.societyId, e.title), await sealText(a.societyId, e.description), await sealText(a.societyId, e.location), e.startsAt, e.endsAt, e.allDay, a.session!.sub, e.responseVisibility],
  );
  notifyNew({ societyId: a.societyId, kind: 'events', authorId: a.session!.sub, title: e.title, url: `/society/${a.societyId}/events` });
  return NextResponse.json({ id: row.id }, { status: 201 });
}

export const POST = lockSafe(handlePOST);
