import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { liveParticipants, logRtc, rtcConfigured, societyRooms } from '@/lib/rtc';

// GET — the Society's rooms and who is in each right now. Members only.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.isMember && !a.canModerate) return NextResponse.json({ error: 'Join this Society to use its rooms' }, { status: 403 });
  const rooms = await societyRooms(a.societyId);
  const live = await liveParticipants(rooms);
  const { rows: [u] } = a.session
    ? await pool.query(`SELECT COALESCE(NULLIF(user_full_name, ''), user_handle) AS name FROM users WHERE id = $1`, [a.session.sub])
    : { rows: [] };
  return NextResponse.json({
    available: rtcConfigured(),
    canModerate: a.canModerate,
    me: a.session?.sub ?? null,
    myName: u?.name ?? 'Member',
    rooms: rooms.map(r => ({ ...r, participants: live.get(r.id) ?? [] })),
  });
}

// POST { name, mode?, max_participants? } — a new room. Moderators.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Only moderators can add rooms' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? '').trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: 'Give the room a name' }, { status: 400 });
  const { rows: [n] } = await pool.query('SELECT count(*)::int AS n FROM society_rtc_rooms WHERE customer_id = $1 AND deleted_at IS NULL', [a.societyId]);
  if (n.n >= 20) return NextResponse.json({ error: 'At most 20 rooms per Society' }, { status: 400 });
  const mode = b.mode === 'audio' ? 'audio' : 'video';
  const max = Math.max(2, Math.min(50, Number(b.max_participants) || 25));
  const { rows: [room] } = await pool.query(
    `INSERT INTO society_rtc_rooms (customer_id, name, mode, max_participants, e2ee, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [a.societyId, name, mode, max, b.e2ee === true, a.session!.sub]);
  await logRtc(a.societyId, room.id, a.session!.sub, 'create');
  return NextResponse.json({ id: room.id }, { status: 201 });
}
