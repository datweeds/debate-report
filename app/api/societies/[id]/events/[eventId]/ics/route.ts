import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { toIcs } from '@/lib/events';

type Params = { params: Promise<{ id: string; eventId: string }> };

// GET — the event as an .ics file for Apple, Google or Outlook calendars.
export async function GET(req: NextRequest, { params }: Params) {
  const { id, eventId } = await params;
  const a = await societyContentAccess(req, id);
  if (!a || !/^[0-9a-f-]{36}$/i.test(eventId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { rows: [e] } = await pool.query(
    `SELECT e.id, e.title, e.description, e.location, e.starts_at, e.ends_at, e.all_day, c.name AS society
     FROM society_events e JOIN customers c ON c.id = e.customer_id
     WHERE e.id = $1 AND e.customer_id = $2 AND e.deleted_at IS NULL`,
    [eventId, a.societyId],
  );
  if (!e) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://new.vote';
  const body = toIcs(e, e.society, `${base}/society/${a.societyId}/events`);
  const safe = e.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'event';
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safe}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
