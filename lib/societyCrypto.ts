// Encryption at rest for private Societies. Server-only.
//
// Each Society has its own random data key, stored in society_keys wrapped
// (AES-256-GCM) by the master key (lib/masterKey.ts), which is never in the
// database and can be held off the server entirely.
// Content of a private Society (apply/invite) is stored as "enc2:<Society id>:"
// + base64 of iv | tag | ciphertext (older rows: "enc1:" without the id);
// files start with a magic header. Carrying the Society id lets a whole API
// response be decrypted in one go (openDeep) once access has been checked. Reading accepts
// both, so public content and older rows keep working.
//
// What this protects: database dumps, backups, disks, read-only database
// access, and — with the master key held offline — the server itself while
// it is stopped. What it doesn't: the running app (it must decrypt to show
// content). Without the master key, private content reads as locked.

import crypto from 'crypto';
import pool from './db';
import { isLockedError, requireKey } from './masterKey';

const PREFIX = 'enc1:';
const PREFIX2 = 'enc2:';
const ENC2 = /^enc2:(\d+):/;
const FILE_MAGIC = Buffer.from('DRENC1\0');
export const UNREADABLE = '[This content can no longer be decrypted]';
export const LOCKED_TEXT = '🔒 Locked: this private Society’s content is unavailable until an administrator unlocks it.';
const masterKey = requireKey;

function seal(key: Buffer, plain: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]);
}

function open(key: Buffer, blob: Buffer): Buffer {
  const d = crypto.createDecipheriv('aes-256-gcm', key, blob.subarray(0, 12));
  d.setAuthTag(blob.subarray(12, 28));
  return Buffer.concat([d.update(blob.subarray(28)), d.final()]);
}

// ── Keys and visibility (cached briefly) ─────────────────────────────────────

const keyCache = new Map<number, { at: number; key: Buffer }>();
const privCache = new Map<number, { at: number; priv: boolean }>();
const TTL = 60_000;

async function societyKey(customerId: number): Promise<Buffer> {
  const hit = keyCache.get(customerId);
  if (hit && Date.now() - hit.at < TTL) return hit.key;
  let { rows: [row] } = await pool.query('SELECT wrapped_key FROM society_keys WHERE customer_id = $1', [customerId]);
  if (!row) {
    const wrapped = seal(masterKey(), crypto.randomBytes(32)).toString('base64');
    await pool.query('INSERT INTO society_keys (customer_id, wrapped_key) VALUES ($1, $2) ON CONFLICT DO NOTHING', [customerId, wrapped]);
    ({ rows: [row] } = await pool.query('SELECT wrapped_key FROM society_keys WHERE customer_id = $1', [customerId]));
  }
  const key = open(masterKey(), Buffer.from(row.wrapped_key, 'base64'));
  keyCache.set(customerId, { at: Date.now(), key });
  return key;
}

export async function isPrivateSociety(customerId: number | null | undefined): Promise<boolean> {
  if (customerId == null) return false;
  const hit = privCache.get(customerId);
  if (hit && Date.now() - hit.at < TTL) return hit.priv;
  const { rows: [r] } = await pool.query('SELECT visibility FROM customers WHERE id = $1', [customerId]);
  const priv = !!r && r.visibility !== 'public';
  privCache.set(customerId, { at: Date.now(), priv });
  return priv;
}

/** Drop every cached Society key (when the master key is locked away). */
export function forgetAllKeys() {
  for (const v of keyCache.values()) v.key.fill(0);
  keyCache.clear();
}

export function forgetSociety(customerId: number) {
  keyCache.delete(customerId);
  privCache.delete(customerId);
}

export const isSealed = (v: unknown): v is string => typeof v === 'string' && (v.startsWith(PREFIX2) || v.startsWith(PREFIX));

// ── Text ─────────────────────────────────────────────────────────────────────

/** For storing: encrypted if the Society is private, unchanged otherwise. */
export async function sealText<T extends string | null | undefined>(customerId: number | null, text: T, force?: boolean): Promise<T> {
  if (text == null || isSealed(text)) return text;
  if (!(force ?? await isPrivateSociety(customerId))) return text;
  return (`${PREFIX2}${customerId}:` + seal(await societyKey(customerId!), Buffer.from(text, 'utf8')).toString('base64')) as T;
}

/** For showing: decrypted if it was stored encrypted. */
export async function openText<T extends string | null | undefined>(customerId: number | null, value: T): Promise<T> {
  if (!isSealed(value)) return value;
  const m = value.match(ENC2);
  const cid = m ? Number(m[1]) : customerId;
  if (cid == null) return value;
  try {
    return open(await societyKey(cid), Buffer.from(value.slice(m ? m[0].length : PREFIX.length), 'base64')).toString('utf8') as T;
  } catch (e) {
    return (isLockedError(e) ? LOCKED_TEXT : UNREADABLE) as T;
  }
}

/**
 * Decrypt every encrypted string anywhere in a value (rows, nested JSON), in
 * place. Only for data the viewer has already been allowed to see.
 */
export async function openDeep<T>(value: T): Promise<T> {
  return walk(value, v => openText(null, v)) as Promise<T>;
}

/** Replace every encrypted string with a placeholder: for admin views without access. */
export async function redactDeep<T>(value: T, placeholder = '🔒 Private'): Promise<T> {
  return walk(value, async () => placeholder) as Promise<T>;
}

async function walk(v: unknown, fn: (s: string) => Promise<string>): Promise<unknown> {
  if (isSealed(v)) return fn(v);
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) v[i] = await walk(v[i], fn); return v; }
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    const o = v as Record<string, unknown>;
    for (const k of Object.keys(o)) o[k] = await walk(o[k], fn);
  }
  return v;
}

/** Decrypt the given fields of each row (rows from one Society). */
export async function openRows<R extends Record<string, unknown>>(customerId: number, rows: R[], fields: (keyof R)[]): Promise<R[]> {
  for (const r of rows) {
    for (const f of fields) (r as Record<string, unknown>)[f as string] = await openText(customerId, r[f] as string | null);
  }
  return rows;
}

// ── Files ────────────────────────────────────────────────────────────────────

export async function sealFile(customerId: number, data: Buffer, force?: boolean): Promise<Buffer> {
  if (data.subarray(0, FILE_MAGIC.length).equals(FILE_MAGIC)) return data;
  if (!(force ?? await isPrivateSociety(customerId))) return data;
  return Buffer.concat([FILE_MAGIC, seal(await societyKey(customerId), data)]);
}

export async function openFile(customerId: number, data: Buffer): Promise<Buffer> {
  if (!data.subarray(0, FILE_MAGIC.length).equals(FILE_MAGIC)) return data;
  return open(await societyKey(customerId), data.subarray(FILE_MAGIC.length));
}

export const fileIsSealed = (head: Buffer) => head.subarray(0, FILE_MAGIC.length).equals(FILE_MAGIC);
