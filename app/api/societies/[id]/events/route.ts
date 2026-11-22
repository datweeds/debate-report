import { NextRequest, NextResponse } from 'next/server';
import { checkOccurrences, readRule } from '@/lib/recurrence';
import { entitlementsFor, planRefusal } from '@/lib/plans';
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
            e.created_by, e.response_visibility, e.series_id, s.rule AS series_rule
     FROM society_events e LEFT JOIN users u ON u.id = e.created_by LEFT JOIN society_event_series s ON s.id = e.series_id
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
      ...tasks.map(t => ({ ...t, kind: 'project', done: t.status === 'complete', status: STATUS[t.status] ?? t.status, href: `/society/${a.societyId}/projects/${t.project_id}` })),
      ...quick.map(t => ({ ...t, kind: 'task', done: t.status === 'complete', project: `T-${String(t.number).padStart(4, '0')}`, status: STATUS[t.status] ?? t.status, href: `/society/${a.societyId}/tasks?task=${t.id}` })),
    ],
    canModerate: a.canModerate,
  });
}

// POST — moderators add an event, or a repeating series of them:
// { …event, repeat: { freq, interval, until }, occurrences: [{ startsAt, endsAt }] }
// (the browser works out the dates in its own time zone; they're checked here).
async function handlePOST(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Only Society Admins can add events' }, { status: 403 });
  const sealed = await sealedSection(a.societyId, 'calendar');
  const body = await req.json().catch(() => ({}));
  const e = readEvent(body, sealed ? v => sealedFor(sealed, v, 30000) : undefined);
  if (!e.ok) return NextResponse.json({ error: e.error }, { status: 400 });
  let dates = [{ startsAt: e.startsAt.toISOString(), endsAt: e.endsAt?.toISOString() ?? null }];
  const rule = body.repeat ? readRule(body.repeat) : null;
  if (body.repeat) {
    if (!rule) return NextResponse.json({ error: 'The repeat setting isn’t valid' }, { status: 400 });
    const ent = await entitlementsFor(a.societyId);
    if (ent.enforced && !ent.limits.recurringEvents) return planRefusal(`Repeating events are on the Team and Network plans; this Society is on ${ent.name}.`);
    const occ = checkOccurrences(body.occurrences, e, rule);
    if (typeof occ === 'string') return NextResponse.json({ error: occ }, { status: 400 });
    dates = occ;
  }
  const [title, description, location] = await Promise.all([sealText(a.societyId, e.title), sealText(a.societyId, e.description), sealText(a.societyId, e.location)]);
  const client = await pool.connect();
  let firstId: string | null = null;
  try {
    await client.query('BEGIN');
    const seriesId = rule ? (await client.query(
      'INSERT INTO society_event_series (customer_id, rule, created_by) VALUES ($1, $2, $3) RETURNING id', [a.societyId, rule, a.session!.sub])).rows[0].id : null;
    for (const d of dates) {
      const { rows: [row] } = await client.query(
        `INSERT INTO society_events (customer_id, title, description, location, starts_at, ends_at, all_day, created_by, response_visibility, series_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [a.societyId, title, description, location, d.startsAt, d.endsAt, e.allDay, a.session!.sub, e.responseVisibility, seriesId]);
      firstId ??= row.id;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  notifyNew({ societyId: a.societyId, kind: 'events', authorId: a.session!.sub, title: e.title, url: `/society/${a.societyId}/events` });
  return NextResponse.json({ id: firstId, count: dates.length }, { status: 201 });
}

export const POST = lockSafe(handlePOST);
