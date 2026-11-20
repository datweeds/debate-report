import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { eventOver } from '@/lib/events';
import { responsesFor } from '@/lib/eventResponses';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string; eventId: string }> };

// PUT { response: 'going' | 'not_going' | null } — a member answers, changes or
// clears their response. Returns what they may now see of the responses.
async function handlePUT(req: NextRequest, { params }: Params) {
  const { id, eventId } = await params;
  const a = await societyContentAccess(req, id);
  if (!a || !/^[0-9a-f-]{36}$/i.test(eventId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { rows: [e] } = await pool.query(
    `SELECT id, created_by, response_visibility, starts_at, ends_at, all_day FROM society_events
     WHERE id = $1 AND customer_id = $2 AND deleted_at IS NULL`, [eventId, a.societyId]);
  if (!e) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.session || !a.isMember) return NextResponse.json({ error: 'Only members of this Society can respond' }, { status: 403 });
  if (e.response_visibility === 'off') return NextResponse.json({ error: 'This event isn’t asking for responses' }, { status: 400 });
  if (eventOver(e)) return NextResponse.json({ error: 'This event has finished' }, { status: 400 });
  const r = (await req.json().catch(() => ({}))).response;
  if (r === null) {
    await pool.query('DELETE FROM event_responses WHERE event_id = $1 AND user_id = $2', [eventId, a.session.sub]);
  } else if (r === 'going' || r === 'not_going') {
    await pool.query(
      `INSERT INTO event_responses (event_id, user_id, response) VALUES ($1, $2, $3)
       ON CONFLICT (event_id, user_id) DO UPDATE SET response = EXCLUDED.response, updated_at = now()`,
      [eventId, a.session.sub, r]);
  } else {
    return NextResponse.json({ error: 'Choose “Planning to attend” or “Not coming”' }, { status: 400 });
  }
  const m = await responsesFor([e], { me: a.session.sub, isMember: a.isMember, canModerate: a.canModerate });
  return NextResponse.json({ responses: m.get(e.id) ?? null });
}

export const PUT = lockSafe(handlePUT);
