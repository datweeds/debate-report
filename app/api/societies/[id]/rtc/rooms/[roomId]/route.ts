import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { endRoom, getRoom, logRtc, muteParticipant, removeParticipant } from '@/lib/rtc';

type Ctx = { params: Promise<{ id: string; roomId: string }> };

async function moderated(req: NextRequest, { params }: Ctx) {
  const { id, roomId } = await params;
  const a = await societyContentAccess(req, id);
  if (!a) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (!a.canModerate) return { error: NextResponse.json({ error: 'Society Admins only' }, { status: 403 }) };
  const room = await getRoom(a.societyId, roomId);
  if (!room) return { error: NextResponse.json({ error: 'Room not found' }, { status: 404 }) };
  return { a, room };
}

const UUID = /^[0-9a-f-]{36}$/i;

// PATCH { name?, mode?, max_participants?, locked? } — room settings. Moderators.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { a, room, error } = await moderated(req, ctx);
  if (error) return error;
  const b = await req.json().catch(() => ({}));
  const name = typeof b.name === 'string' && b.name.trim() ? b.name.trim().slice(0, 80) : room.name;
  const mode = b.mode === 'audio' || b.mode === 'video' ? b.mode : room.mode;
  const max = b.max_participants !== undefined ? Math.max(2, Math.min(50, Number(b.max_participants) || 25)) : room.max_participants;
  const locked = typeof b.locked === 'boolean' ? b.locked : room.locked;
  const e2ee = typeof b.e2ee === 'boolean' ? b.e2ee : room.e2ee;
  await pool.query('UPDATE society_rtc_rooms SET name = $2, mode = $3, max_participants = $4, locked = $5, e2ee = $6 WHERE id = $1',
    [room.id, name, mode, max, locked, e2ee]);
  // Switching encryption on or off: end the current call so nobody stays on the old setting
  if (e2ee !== room.e2ee) await endRoom(room);
  if (locked !== room.locked) await logRtc(a.societyId, room.id, a.session!.sub, locked ? 'lock' : 'unlock');
  return NextResponse.json({ ok: true });
}

// DELETE — remove the room (ends any call in it). The standing room can't be deleted.
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { a, room, error } = await moderated(req, ctx);
  if (error) return error;
  if (room.is_default) return NextResponse.json({ error: 'The Society room can’t be deleted' }, { status: 400 });
  await endRoom(room);
  await pool.query('UPDATE society_rtc_rooms SET deleted_at = now() WHERE id = $1', [room.id]);
  await logRtc(a.societyId, room.id, a.session!.sub, 'delete');
  return NextResponse.json({ ok: true });
}

// POST { action: 'mute' | 'remove' | 'end', identity? } — moderation in a live call
export async function POST(req: NextRequest, ctx: Ctx) {
  const { a, room, error } = await moderated(req, ctx);
  if (error) return error;
  const { action, identity } = await req.json().catch(() => ({}));
  try {
    if (action === 'end') {
      await endRoom(room);
    } else if ((action === 'mute' || action === 'remove') && typeof identity === 'string' && UUID.test(identity)) {
      if (action === 'mute') await muteParticipant(room, identity);
      else {
        await removeParticipant(room, identity);
        // Barred from rejoining this room for an hour
        await pool.query(
          `INSERT INTO society_rtc_bans (room_id, user_id, until) VALUES ($1, $2, now() + interval '1 hour')
           ON CONFLICT (room_id, user_id) DO UPDATE SET until = EXCLUDED.until`, [room.id, identity]);
      }
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[rtc] moderate', err);
    return NextResponse.json({ error: 'That person isn’t in the room any more' }, { status: 409 });
  }
  await logRtc(a.societyId, room.id, a.session!.sub, action, typeof identity === 'string' && UUID.test(identity) ? identity : null);
  return NextResponse.json({ ok: true });
}
