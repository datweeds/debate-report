// Audio and video rooms for Societies, on the self-hosted LiveKit server.
// The app decides who may join and with what rights; LiveKit enforces it
// through short-lived tokens. Rooms are created only here, never by
// browsers. Server-only.

import { AccessToken, RoomServiceClient, TrackSource, TrackType } from 'livekit-server-sdk';
import pool from './db';

const URL = process.env.LIVEKIT_URL ?? '';            // what browsers connect to (wss://…)
const API_URL = process.env.LIVEKIT_API_URL ?? '';    // server API, internal
const KEY = process.env.LIVEKIT_API_KEY ?? '';
const SECRET = process.env.LIVEKIT_API_SECRET ?? '';

export const rtcConfigured = () => !!(URL && API_URL && KEY && SECRET);
const service = () => new RoomServiceClient(API_URL, KEY, SECRET);

export type RtcRoom = {
  id: string; customer_id: number; name: string; mode: 'video' | 'audio'; max_participants: number;
  is_default: boolean; locked: boolean; e2ee: boolean; created_at: string;
};

// LiveKit room name: one per app room, namespaced away from Element Call's rooms
export const livekitName = (roomId: string) => `dr-${roomId}`;

export async function societyRooms(societyId: number): Promise<RtcRoom[]> {
  // Every Society has a standing room
  await pool.query(
    `INSERT INTO society_rtc_rooms (customer_id, name, is_default) VALUES ($1, 'Society room', TRUE)
     ON CONFLICT DO NOTHING`, [societyId]);
  const { rows } = await pool.query(
    `SELECT id, customer_id, name, mode, max_participants, is_default, locked, e2ee, created_at
     FROM society_rtc_rooms WHERE customer_id = $1 AND deleted_at IS NULL
     ORDER BY is_default DESC, created_at`, [societyId]);
  return rows;
}

export async function getRoom(societyId: number, roomId: string): Promise<RtcRoom | null> {
  if (!/^[0-9a-f-]{36}$/i.test(roomId)) return null;
  const { rows: [r] } = await pool.query(
    `SELECT id, customer_id, name, mode, max_participants, is_default, locked, e2ee, created_at
     FROM society_rtc_rooms WHERE id = $1 AND customer_id = $2 AND deleted_at IS NULL`, [roomId, societyId]);
  return r ?? null;
}

export type LiveParticipant = { identity: string; name: string; joinedAt: number; micOn: boolean; cameraOn: boolean };

// Who is in each room right now (empty rooms are not running on LiveKit)
export async function liveParticipants(rooms: RtcRoom[]): Promise<Map<string, LiveParticipant[]>> {
  const out = new Map<string, LiveParticipant[]>();
  if (!rtcConfigured() || !rooms.length) return out;
  const svc = service();
  const running = new Set((await svc.listRooms(rooms.map(r => livekitName(r.id))).catch(() => [])).map(r => r.name));
  await Promise.all(rooms.filter(r => running.has(livekitName(r.id))).map(async r => {
    const ps = await svc.listParticipants(livekitName(r.id)).catch(() => []);
    out.set(r.id, ps.map(p => ({
      identity: p.identity, name: p.name || 'Someone', joinedAt: Number(p.joinedAt),
      micOn: p.tracks.some(t => t.type === TrackType.AUDIO && !t.muted),
      cameraOn: p.tracks.some(t => t.type === TrackType.VIDEO && t.source === TrackSource.CAMERA && !t.muted),
    })));
  }));
  return out;
}

// Create the LiveKit room on first join; it closes itself 5 minutes after it empties
async function ensureLiveRoom(room: RtcRoom) {
  await service().createRoom({ name: livekitName(room.id), emptyTimeout: 300, departureTimeout: 20, maxParticipants: room.max_participants });
}

// A token for one user, one room, ten minutes (LiveKit refreshes it while connected)
export async function joinToken(room: RtcRoom, user: { id: string; name: string }, moderator: boolean): Promise<{ url: string; token: string }> {
  await ensureLiveRoom(room);
  const at = new AccessToken(KEY, SECRET, { identity: user.id, name: user.name, ttl: '10m' });
  at.addGrant({
    roomJoin: true, room: livekitName(room.id),
    canPublish: true, canSubscribe: true, canPublishData: true,
    canPublishSources: room.mode === 'audio'
      ? [TrackSource.MICROPHONE]
      : [TrackSource.MICROPHONE, TrackSource.CAMERA, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO],
    roomAdmin: moderator,
  });
  return { url: URL, token: await at.toJwt() };
}

export async function muteParticipant(room: RtcRoom, identity: string) {
  const svc = service();
  const p = await svc.getParticipant(livekitName(room.id), identity);
  for (const t of p.tracks) {
    if (t.type === TrackType.AUDIO && !t.muted) await svc.mutePublishedTrack(livekitName(room.id), identity, t.sid, true);
  }
}

export async function removeParticipant(room: RtcRoom, identity: string) {
  await service().removeParticipant(livekitName(room.id), identity);
}

export async function endRoom(room: RtcRoom) {
  await service().deleteRoom(livekitName(room.id)).catch(() => {});
}

export async function logRtc(societyId: number, roomId: string | null, actor: string | null, action: string, target: string | null = null) {
  await pool.query(
    'INSERT INTO society_rtc_log (customer_id, room_id, actor, action, target) VALUES ($1, $2, $3, $4, $5)',
    [societyId, roomId, actor, action, target]).catch(err => console.error('[rtc] log', err));
}
