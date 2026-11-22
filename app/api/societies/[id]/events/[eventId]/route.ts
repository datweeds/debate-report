import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { readEvent } from '@/lib/events';
import { sealText } from '@/lib/societyCrypto';
import { lockSafe } from '@/lib/lockSafe';
import { sealedFor, sealedSection } from '@/lib/sealed/server';

type Params = { params: Promise<{ id: string; eventId: string }> };

async function exists(societyId: number, eventId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return false;
  const { rows } = await pool.query('SELECT 1 FROM society_events WHERE id = $1 AND customer_id = $2 AND deleted_at IS NULL', [eventId, societyId]);
  return rows.length > 0;
}

// PATCH — moderators edit an event (same fields as creating one). In a series,
// { scope: 'following' | 'all' } changes later (or all) events too: their text,
// and their time of day and length, but not their dates.
async function handlePATCH(req: NextRequest, { params }: Params) {
  const { id, eventId } = await params;
  const a = await societyContentAccess(req, id);
  if (!a || !await exists(a.societyId, eventId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const sealed = await sealedSection(a.societyId, 'calendar');
  const body = await req.json().catch(() => ({}));
  const e = readEvent(body, sealed ? v => sealedFor(sealed, v, 30000) : undefined);
  if (!e.ok) return NextResponse.json({ error: e.error }, { status: 400 });
  const { rows: [old] } = await pool.query('SELECT series_id, starts_at, all_day FROM society_events WHERE id = $1', [eventId]);
  if (old.series_id && (body.scope === 'following' || body.scope === 'all')) {
    if (e.allDay !== old.all_day) return NextResponse.json({ error: 'Change “all day” for one event at a time' }, { status: 400 });
    const shift = (e.startsAt.getTime() - new Date(old.starts_at).getTime()) / 1000;
    if (Math.abs(shift) >= 86400) return NextResponse.json({ error: 'Several events can change their time of day, but not their date. Move events to other days one at a time.' }, { status: 400 });
    const length = e.endsAt ? (e.endsAt.getTime() - e.startsAt.getTime()) / 1000 : null;
    await pool.query(
      `UPDATE society_events SET title = $1, description = $2, location = $3, response_visibility = $4,
              starts_at = starts_at + make_interval(secs => $5),
              ends_at = CASE WHEN $6::float8 IS NULL THEN NULL ELSE starts_at + make_interval(secs => $5) + make_interval(secs => $6::float8) END,
              updated_at = now()
       WHERE series_id = $7 AND customer_id = $8 AND deleted_at IS NULL AND ($9 = 'all' OR starts_at >= $10)`,
      [await sealText(a.societyId, e.title), await sealText(a.societyId, e.description), await sealText(a.societyId, e.location), e.responseVisibility,
       shift, length, old.series_id, a.societyId, body.scope, old.starts_at]);
    return NextResponse.json({ ok: true });
  }
  await pool.query(
    `UPDATE society_events SET title = $1, description = $2, location = $3, starts_at = $4, ends_at = $5, all_day = $6, response_visibility = $8, updated_at = now()
     WHERE id = $7`,
    [await sealText(a.societyId, e.title), await sealText(a.societyId, e.description), await sealText(a.societyId, e.location), e.startsAt, e.endsAt, e.allDay, eventId, e.responseVisibility],
  );
  return NextResponse.json({ ok: true });
}

// DELETE ?scope=following|all — moderators, or SysAdmin as takedown. In a
// series, also later (or all) events.
async function handleDELETE(req: NextRequest, { params }: Params) {
  const { id, eventId } = await params;
  const a = await societyContentAccess(req, id);
  if (!a || !await exists(a.societyId, eventId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canTakeDown) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const scope = req.nextUrl.searchParams.get('scope');
  const { rows: [old] } = await pool.query('SELECT series_id, starts_at FROM society_events WHERE id = $1', [eventId]);
  if (old.series_id && (scope === 'following' || scope === 'all')) {
    await pool.query(
      `UPDATE society_events SET deleted_at = now() WHERE series_id = $1 AND customer_id = $2 AND deleted_at IS NULL AND ($3 = 'all' OR starts_at >= $4)`,
      [old.series_id, a.societyId, scope, old.starts_at]);
  } else {
    await pool.query('UPDATE society_events SET deleted_at = now() WHERE id = $1', [eventId]);
  }
  return NextResponse.json({ ok: true });
}

export const PATCH = lockSafe(handlePATCH);
export const DELETE = lockSafe(handleDELETE);
