// Sealed items on the server: it stores people's locked identities and each
// item's locked keys, checks who may hold them, and never sees a key itself.
// Server-only.

import pool from '../db';
import { UUID_RE } from '../discussions';

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
export const UUID_RE_SEALED = UUID_RE;

/** Text that should (or shouldn't) have been sealed in the browser: lockSafe answers it with a 400. */
export class SealedTextError extends Error { code = 'SEALED_TEXT'; }
const b64 = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max && B64.test(v);

export type StoredIdentity = { publicKey: string; vault: string; phraseLock: string };

/** Whether a Society lets its members create Sealed items. */
export async function allowsSealed(societyId: number): Promise<boolean> {
  const { rows: [c] } = await pool.query('SELECT allow_sealed FROM customers WHERE id = $1', [societyId]);
  return !!c?.allow_sealed;
}

export async function getIdentity(userId: string): Promise<StoredIdentity | null> {
  const { rows: [r] } = await pool.query(
    'SELECT public_key AS "publicKey", vault, phrase_lock AS "phraseLock" FROM user_sealed_keys WHERE user_id = $1', [userId]);
  return r ?? null;
}

/** null = saved; otherwise the problem. A reset replaces the identity and drops the keys locked for the old one. */
export async function saveIdentity(userId: string, b: unknown, reset: boolean): Promise<string | null> {
  const s = b as Partial<StoredIdentity> | null;
  if (!s || !b64(s.publicKey, 64) || !b64(s.vault, 200) || !b64(s.phraseLock, 200)) return 'That key wasn’t understood';
  const existing = await getIdentity(userId);
  if (existing && !reset) return 'Secure access is already set up for your account';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (existing) await client.query('DELETE FROM sealed_item_keys WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM user_sealed_passkeys WHERE user_id = $1', [userId]);   // they opened the old key
    await client.query(
      `INSERT INTO user_sealed_keys (user_id, public_key, vault, phrase_lock) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET public_key = $2, vault = $3, phrase_lock = $4, updated_at = now()`,
      [userId, s.publicKey, s.vault, s.phraseLock]);
    await client.query('COMMIT');
    return null;
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

// ── Passkeys that unlock secure access ──────────────────────────────────────

/** This person's passkeys (their account's), and which of them unlock secure access. */
export async function sealedPasskeys(userId: string) {
  const { rows } = await pool.query(
    `SELECT p.credential_id AS "credentialId", p.device_type AS "deviceType", p.created_at AS "createdAt", p.last_used_at AS "lastUsedAt",
            s.lock, s.created_at AS "unlocksSince"
     FROM passkeys p
     LEFT JOIN user_sealed_keys k ON k.user_id = p.user_id
     LEFT JOIN user_sealed_passkeys s ON s.user_id = p.user_id AND s.credential_id = p.credential_id AND s.public_key = k.public_key
     WHERE p.user_id = $1 ORDER BY p.created_at`, [userId]);
  return rows as { credentialId: string; deviceType: string | null; createdAt: string; lastUsedAt: string | null; lock: string | null; unlocksSince: string | null }[];
}

/** Let one of this person's passkeys unlock their secure access. null = saved; otherwise the problem. */
export async function savePasskeyLock(userId: string, credentialId: unknown, lock: unknown): Promise<string | null> {
  if (typeof credentialId !== 'string' || credentialId.length > 1400 || !b64(lock, 200)) return 'That passkey wasn’t understood';
  const identity = await getIdentity(userId);
  if (!identity) return 'Set up secure access first';
  const { rows } = await pool.query('SELECT 1 FROM passkeys WHERE user_id = $1 AND credential_id = $2', [userId, credentialId]);
  if (!rows.length) return 'That passkey isn’t one of your account’s passkeys';
  await pool.query(
    `INSERT INTO user_sealed_passkeys (user_id, credential_id, lock, public_key) VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, credential_id) DO UPDATE SET lock = $3, public_key = $4, created_at = now()`,
    [userId, credentialId, lock, identity.publicKey]);
  return null;
}

export async function removePasskeyLock(userId: string, credentialId: string) {
  await pool.query('DELETE FROM user_sealed_passkeys WHERE user_id = $1 AND credential_id = $2', [userId, credentialId]);
}

// Everyone who belongs to a Society (members and its admins)
// (user ids are text in customer_members, so compare as text)
const MEMBERS = `SELECT user_id::text AS user_id FROM customer_members WHERE customer_id = $1
                 UNION SELECT user_id::text FROM customer_roles WHERE tenant_id = $1 AND role = 'customer_admin'`;

/** A Society's members, with their public keys (null until they set up secure access). */
export async function sealedMembers(societyId: number) {
  const { rows } = await pool.query(
    `SELECT u.id AS user_id, u.user_handle AS handle, u.user_full_name AS name, k.public_key
     FROM (${MEMBERS}) m JOIN users u ON u.id::text = m.user_id LEFT JOIN user_sealed_keys k ON k.user_id = u.id
     ORDER BY u.user_handle`, [societyId]);
  return rows as { user_id: string; handle: string; name: string | null; public_key: string | null }[];
}

export type ItemType = 'thread' | 'calendar' | 'principles' | 'debates' | 'project' | 'folder' | 'poll';
export type Section = 'calendar' | 'principles' | 'debates';
export const SECTIONS: Section[] = ['calendar', 'principles', 'debates'];
export type SealedItem = { type: ItemType; id: string; societyId: number; epoch: number };

// Where each kind of single sealed item keeps its current epoch
const ITEM_TABLE: Partial<Record<ItemType, string>> = {
  thread: 'discussion_threads', project: 'projects', folder: 'document_folders', poll: 'society_polls',
};

/** A whole section of a Society that is sealed (its calendar, principles, all debates), or null. */
export async function sealedSection(societyId: number, section: Section): Promise<SealedItem | null> {
  const { rows: [r] } = await pool.query(
    'SELECT item_id, sealed_epoch FROM society_sealed_sections WHERE customer_id = $1 AND section = $2', [societyId, section]);
  return r ? { type: section, id: r.item_id, societyId, epoch: r.sealed_epoch } : null;
}

/** Any sealed item of this Society, by type and id. */
export async function sealedItem(societyId: number, type: string, id: string): Promise<SealedItem | null> {
  if (!UUID_RE.test(id)) return null;
  if ((SECTIONS as string[]).includes(type)) {
    const s = await sealedSection(societyId, type as Section);
    return s && s.id === id ? s : null;
  }
  const table = ITEM_TABLE[type as ItemType];
  if (!table) return null;
  const { rows: [t] } = await pool.query(
    `SELECT sealed_epoch FROM ${table} WHERE id = $1 AND customer_id = $2 AND protection = 'sealed'${table === 'document_folders' ? '' : ' AND deleted_at IS NULL'}`, [id, societyId]);
  return t ? { type: type as ItemType, id, societyId, epoch: t.sealed_epoch ?? 1 } : null;
}

/** Store the first key of a newly sealed item: locked for every member with secure access, the sealer included. */
export async function firstLocks(q: Pick<import('pg').PoolClient, 'query'>, item: SealedItem, byUser: string, locks: Lock[]): Promise<string | null> {
  const withKey = new Set((await sealedMembers(item.societyId)).filter(m => m.public_key).map(m => m.user_id));
  if (!withKey.has(byUser)) return 'Set up secure access first';
  if (!locks.some(l => l.userId === byUser)) return 'The key must include your own';
  for (const l of locks) {
    if (!withKey.has(l.userId)) continue;
    await q.query(
      `INSERT INTO sealed_item_keys (item_type, item_id, epoch, user_id, locked_key, locked_by) VALUES ($1, $2, 1, $3, $4, $5)
       ON CONFLICT DO NOTHING`, [item.type, item.id, l.userId, l.lockedKey, byUser]);
  }
  return null;
}

/** A sealed thread in this Society, with its current epoch. */
export const sealedThread = (societyId: number, threadId: string) => sealedItem(societyId, 'thread', threadId);

/**
 * The item's keys as one person sees them: the keys locked for them, which
 * members hold which epochs (so a member's browser can share with those
 * missing), and whether the current epoch is held by someone who has left
 * (so the next writer starts a new one).
 */
export async function itemKeys(item: SealedItem, userId: string) {
  const [members, { rows: locks }] = await Promise.all([
    sealedMembers(item.societyId),
    pool.query('SELECT epoch, user_id, locked_key FROM sealed_item_keys WHERE item_type = $1 AND item_id = $2 ORDER BY epoch',
      [item.type, item.id]),
  ]);
  const memberIds = new Set(members.map(m => m.user_id));
  const held = new Map<string, number[]>();
  for (const l of locks) held.set(l.user_id, [...(held.get(l.user_id) ?? []), l.epoch]);
  return {
    epoch: item.epoch,
    mine: locks.filter(l => l.user_id === userId).map(l => ({ epoch: l.epoch, lockedKey: l.locked_key })),
    members: members.map(m => ({ ...m, epochs: held.get(m.user_id) ?? [] })),
    needsNewEpoch: locks.some(l => l.epoch === item.epoch && !memberIds.has(l.user_id)),
  };
}

/** A sealed thread's keys for this person, for every sealed thread in a Society (to show the list). */
export const myThreadKeys = (societyId: number, userId: string) => myKeysOfType(societyId, userId, 'thread');

/** This person's keys for every sealed item of one kind in a Society (threads, projects, folders, polls), to show lists. */
export async function myKeysOfType(societyId: number, userId: string, type: 'thread' | 'project' | 'folder' | 'poll') {
  const table = ITEM_TABLE[type]!;
  const { rows } = await pool.query(
    `SELECT k.item_id, k.epoch, k.locked_key FROM sealed_item_keys k
     JOIN ${table} t ON t.id = k.item_id AND t.customer_id = $1 AND t.protection = 'sealed'${table === 'document_folders' ? '' : ' AND t.deleted_at IS NULL'}
     WHERE k.item_type = $3 AND k.user_id = $2`, [societyId, userId, type]);
  const out: Record<string, { epoch: number; lockedKey: string }[]> = {};
  for (const r of rows) (out[r.item_id] ??= []).push({ epoch: r.epoch, lockedKey: r.locked_key });
  return out;
}

export type Lock = { userId: string; lockedKey: string };

export function readLocks(v: unknown): Lock[] | null {
  if (!Array.isArray(v) || v.length > 1000) return null;
  const out: Lock[] = [];
  for (const l of v) {
    if (typeof l?.userId !== 'string' || !UUID_RE.test(l.userId) || !b64(l.lockedKey, 200)) return null;
    out.push({ userId: l.userId, lockedKey: l.lockedKey });
  }
  return out;
}

/**
 * Store item keys locked by `byUser` for members. For an existing epoch the
 * giver must hold it already; a new epoch must be the next one, include the
 * giver's own lock, and becomes current. Only current members with a public
 * key can be given a key; existing locks are never overwritten.
 */
export async function addLocks(item: SealedItem, epoch: number, byUser: string, locks: Lock[], newEpoch: boolean): Promise<string | null> {
  const members = await sealedMembers(item.societyId);
  const withKey = new Set(members.filter(m => m.public_key).map(m => m.user_id));
  if (!withKey.has(byUser)) return 'Set up secure access first';
  if (newEpoch) {
    if (epoch !== item.epoch + 1) return 'Someone else has just updated this item’s keys: try again';
    if (!locks.some(l => l.userId === byUser)) return 'The new key must include your own';
  } else {
    if (!Number.isInteger(epoch) || epoch < 1 || epoch > item.epoch) return 'Unknown key';
    const { rows } = await pool.query(
      'SELECT 1 FROM sealed_item_keys WHERE item_type = $1 AND item_id = $2 AND epoch = $3 AND user_id = $4',
      [item.type, item.id, epoch, byUser]);
    if (!rows.length) return 'You can only share keys you hold';
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (newEpoch) {
      const table = ITEM_TABLE[item.type];
      const { rowCount } = table
        ? await client.query(`UPDATE ${table} SET sealed_epoch = $1 WHERE id = $2 AND COALESCE(sealed_epoch, 1) = $3`, [epoch, item.id, item.epoch])
        : await client.query(`UPDATE society_sealed_sections SET sealed_epoch = $1 WHERE item_id = $2 AND sealed_epoch = $3`, [epoch, item.id, item.epoch]);
      if (!rowCount) { await client.query('ROLLBACK'); return 'Someone else has just updated this item’s keys: try again'; }
    }
    for (const l of locks) {
      if (!withKey.has(l.userId)) continue;
      await client.query(
        `INSERT INTO sealed_item_keys (item_type, item_id, epoch, user_id, locked_key, locked_by) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`, [item.type, item.id, epoch, l.userId, l.lockedKey, byUser]);
    }
    await client.query('COMMIT');
    return null;
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

/** Text sealed in a browser for this item's current epoch (what a sealed item accepts). */
export function sealedFor(item: SealedItem, v: unknown, maxLength = 28000): v is string {
  if (typeof v !== 'string' || v.length > maxLength) return false;
  const m = v.match(/^sn1:(\d+):([A-Za-z0-9+/]+={0,2})$/);
  return !!m && Number(m[1]) === item.epoch;
}

/**
 * Text for a thread: in a sealed thread it must be sealed for the current
 * epoch; elsewhere it must be plain (the server encrypts it). Returns the text
 * to store, or the problem.
 */
export async function threadText(societyId: number, threadId: string, v: unknown, plainMax: number, label: string):
  Promise<{ text: string; sealed: boolean } | { error: string }> {
  const item = await sealedThread(societyId, threadId);
  if (item) {
    return sealedFor(item, v) ? { text: v, sealed: true }
      : { error: 'This sealed discussion’s keys have changed: reload the page and try again' };
  }
  if (typeof v !== 'string' || !v.trim()) return { error: `${label} is empty` };
  if (v.length > plainMax) return { error: `${label} must be ${plainMax.toLocaleString('en-GB')} characters or fewer` };
  if (v.startsWith('sn1:')) return { error: 'This discussion isn’t sealed' };
  return { text: v.trim(), sealed: false };
}
