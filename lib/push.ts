// Browser and phone notifications (Web Push). Server-only.
//
// The message is encrypted for each device by the Web Push standard, so the
// browser makers' push services (Google, Apple, Mozilla) carry it without being
// able to read it. It still shows on the device's screen, so for private
// content we say only what kind of thing is new, and where.

import webpush from 'web-push';
import pool from './db';

let ready: boolean | null = null;
function setup(): boolean {
  if (ready !== null) return ready;
  const { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_EMAIL: email } = process.env;
  ready = !!(pub && priv);
  if (ready) webpush.setVapidDetails(email || 'mailto:contact@new.vote', pub!, priv!);
  return ready;
}

export const publicKey = () => process.env.VAPID_PUBLIC_KEY ?? null;

// What people can be notified about (and switch off one by one)
export const PUSH_KINDS = [
  { id: 'discussions', label: 'New discussions' },
  { id: 'messages', label: 'New messages in discussions you’ve taken part in' },
  { id: 'documents', label: 'New documents and links' },
  { id: 'events', label: 'New events' },
  { id: 'projects', label: 'New projects, and tasks given to you' },
  { id: 'polls', label: 'Polls opening' },
  { id: 'debates', label: 'New debates' },
  { id: 'news', label: 'New News editions' },
  { id: 'principles', label: 'New versions of principles' },
] as const;
export type PushKind = typeof PUSH_KINDS[number]['id'];

export type Payload = { title: string; body: string; url: string; tag?: string };

/** Send to these people's devices, except those who've switched off this kind or this Society. */
export async function pushToUsers(userIds: string[], payload: Payload, about: { kind: PushKind; societyId: number }) {
  if (!userIds.length || !setup()) return;
  const { rows: subs } = await pool.query(
    `SELECT s.id, s.endpoint, s.p256dh, s.auth FROM push_subscriptions s
     LEFT JOIN push_prefs p ON p.user_id = s.user_id
     WHERE s.user_id::text = ANY($1::text[])
       AND NOT (COALESCE(p.muted_kinds, '{}') @> ARRAY[$2]::text[])
       AND NOT (COALESCE(p.muted_societies, '{}') @> ARRAY[$3]::int[])`,
    [userIds, about.kind, about.societyId]);
  await sendAll(subs, payload);
}

/** One person's devices, whatever their settings (e.g. a test notification). */
export async function pushToUser(userId: string, payload: Payload) {
  if (!setup()) return 0;
  const { rows: subs } = await pool.query('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1', [userId]);
  await sendAll(subs, payload);
  return subs.length;
}

async function sendAll(subs: { id: string; endpoint: string; p256dh: string; auth: string }[], payload: Payload) {
  const body = JSON.stringify(payload);
  await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 24 });
      await pool.query('UPDATE push_subscriptions SET last_sent_at = now() WHERE id = $1', [s.id]);
    } catch (e) {
      // The device unsubscribed or the browser was reset: forget it
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [s.id]);
      else console.error('[push]', code ?? (e as Error).message);
    }
  }));
}
