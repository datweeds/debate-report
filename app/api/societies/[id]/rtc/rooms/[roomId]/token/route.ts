import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { getRoom, joinToken, liveParticipants, logRtc, roomStartedAt, rtcConfigured } from '@/lib/rtc';
import { entitlementsFor } from '@/lib/plans';

// Recent token requests per user, to stop runaway clients
const recent = new Map<string, number[]>();

// POST — a short-lived token to join this room as yourself. Members only;
// locked rooms admit moderators only; removed people wait an hour.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; roomId: string }> }) {
  const { id, roomId } = await params;
  const a = await societyContentAccess(req, id);
  if (!a?.session) return NextResponse.json({ error: 'Sign in to join' }, { status: 401 });
  if (!a.isMember && !a.canModerate) return NextResponse.json({ error: 'Join this Society to use its rooms' }, { status: 403 });
  if (!rtcConfigured()) return NextResponse.json({ error: 'Calls aren’t available on this server yet' }, { status: 503 });
  const { rows: [held] } = await pool.query('SELECT 1 FROM customers WHERE id = $1 AND held_at IS NOT NULL', [a.societyId]);
  if (held) return NextResponse.json({ error: 'This Society is read-only for now, so its rooms are closed. A Society Admin can choose a plan for it.' }, { status: 423 });
  const room = await getRoom(a.societyId, roomId);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const me = a.session.sub;
  const now = Date.now();
  const times = (recent.get(me) ?? []).filter(t => now - t < 60_000);
  if (times.length >= 10) return NextResponse.json({ error: 'Too many attempts; wait a minute' }, { status: 429 });
  recent.set(me, [...times, now]);

  if (room.locked && !a.canModerate) return NextResponse.json({ error: 'This room is locked' }, { status: 403 });
  const { rows: [ban] } = await pool.query('SELECT until FROM society_rtc_bans WHERE room_id = $1 AND user_id = $2 AND until > now()', [room.id, me]);
  if (ban && !a.canModerate) return NextResponse.json({ error: 'A Society Admin removed you from this room; try again later' }, { status: 403 });
  const ent = await entitlementsFor(a.societyId);
  const cap = ent.enforced ? Math.min(room.max_participants, ent.limits.meetParticipants) : room.max_participants;
  const inRoom = (await liveParticipants([room])).get(room.id) ?? [];
  if (inRoom.length >= cap && !inRoom.some(p => p.identity === me)) {
    return NextResponse.json({ error: `The room is full (${cap} people${cap < room.max_participants ? ` on the ${ent.name} plan` : ''})` }, { status: 409 });
  }
  // Call length on the Society's plan: when this call ends
  let endsAt: number | null = null;
  if (ent.enforced && ent.limits.meetMinutes) {
    endsAt = ((await roomStartedAt(room)) ?? Date.now()) + ent.limits.meetMinutes * 60_000;
    if (endsAt - Date.now() < 30_000) {
      return NextResponse.json({ error: `This call has reached the ${ent.limits.meetMinutes}-minute limit on the ${ent.name} plan and is ending. You can start a new call in a minute.` }, { status: 409 });
    }
  }

  const { rows: [u] } = await pool.query('SELECT COALESCE(NULLIF(user_full_name, \'\'), user_handle) AS name FROM users WHERE id = $1', [me]);
  const out = await joinToken(room, { id: me, name: u?.name ?? 'Member' }, a.canModerate);
  await logRtc(a.societyId, room.id, me, 'join');
  return NextResponse.json({ ...out, endsAt, room: { id: room.id, name: room.name, mode: room.mode, e2ee: room.e2ee } });
}
