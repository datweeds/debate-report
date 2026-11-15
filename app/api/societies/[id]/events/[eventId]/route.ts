import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { readEvent } from '@/lib/events';

type Params = { params: Promise<{ id: string; eventId: string }> };

async function exists(societyId: number, eventId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return false;
  const { rows } = await pool.query('SELECT 1 FROM society_events WHERE id = $1 AND customer_id = $2 AND deleted_at IS NULL', [eventId, societyId]);
  return rows.length > 0;
}

// PATCH — moderators edit an event (same fields as creating one).
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, eventId } = await params;
  const a = await societyContentAccess(req, id);
  if (!a || !await exists(a.societyId, eventId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const e = readEvent(await req.json().catch(() => ({})));
  if (!e.ok) return NextResponse.json({ error: e.error }, { status: 400 });
  await pool.query(
    `UPDATE society_events SET title = $1, description = $2, location = $3, starts_at = $4, ends_at = $5, all_day = $6, updated_at = now()
     WHERE id = $7`,
    [e.title, e.description, e.location, e.startsAt, e.endsAt, e.allDay, eventId],
  );
  return NextResponse.json({ ok: true });
}

// DELETE — moderators, or SysAdmin as takedown.
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id, eventId } = await params;
  const a = await societyContentAccess(req, id);
  if (!a || !await exists(a.societyId, eventId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canTakeDown) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await pool.query('UPDATE society_events SET deleted_at = now() WHERE id = $1', [eventId]);
  return NextResponse.json({ ok: true });
}
