// The master key that wraps each private Society's key. Server-only.
//
// It lives in one of two places:
//   - "on the server": a key file outside the app (mode 600), read at start-up.
//     Convenient while developing: restarts need nobody.
//   - "offline": held by the operator (e.g. a password manager and an offline
//     copy). After each restart a Sys Admin pastes it into Admin → Privacy; it
//     is then held in this process's memory only, never written anywhere.
// Until it is supplied, private Societies' content stays locked.
//
// Only a fingerprint is kept in the database, to check a supplied key.

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import pool from './db';

const KEY_FILE = process.env.SOCIETY_KEY_FILE || path.join(os.homedir(), '.newvote', 'society-master.key');

// Route bundles can each get their own copy of a module: keep state on globalThis
type Held = { key: Buffer | null; source: 'server' | 'memory' | null; tried: boolean };
const g = globalThis as unknown as { __societyMasterKey?: Held };
const held: Held = (g.__societyMasterKey ??= { key: null, source: null, tried: false });

export class SocietyLockedError extends Error {
  code = 'SOCIETY_LOCKED';
  constructor() { super('Private Societies are locked until an administrator supplies the master key'); }
}
export const isLockedError = (e: unknown) => (e as { code?: string })?.code === 'SOCIETY_LOCKED';

const fingerprint = (key: Buffer) =>
  crypto.createHmac('sha256', key).update('new.vote society master key v1').digest('hex').slice(0, 32);

function parse(text: string): Buffer | null {
  const k = Buffer.from(text.trim(), 'base64');
  return k.length === 32 ? k : null;
}

function readKeyFile(): Buffer | null {
  try { return parse(fs.readFileSync(KEY_FILE, 'utf8')); } catch { return null; }
}

/** The key, if this process has it. Loads it from the server's key file once. */
export function currentKey(): Buffer | null {
  if (held.key) return held.key;
  if (!held.tried) {
    held.tried = true;
    const k = readKeyFile();
    if (k) { held.key = k; held.source = 'server'; void record('loaded', null); }
  }
  return held.key;
}

export function requireKey(): Buffer {
  const k = currentKey();
  if (!k) throw new SocietyLockedError();
  return k;
}

export const isUnlocked = () => currentKey() !== null;

async function record(action: string, userId: string | null) {
  await pool.query('INSERT INTO master_key_log (action, user_id) VALUES ($1, $2)', [action, userId])
    .catch(err => console.error('[master key] log', err));
}

async function storedFingerprint(): Promise<string | null> {
  const { rows: [r] } = await pool.query('SELECT fingerprint FROM master_key_state WHERE id');
  return r?.fingerprint ?? null;
}

/** Is this the right key? Checked against the fingerprint, or against an existing Society key. */
async function matches(key: Buffer): Promise<boolean> {
  const fp = await storedFingerprint();
  if (fp) return crypto.timingSafeEqual(Buffer.from(fp), Buffer.from(fingerprint(key)));
  const { rows: [r] } = await pool.query('SELECT wrapped_key FROM society_keys LIMIT 1');
  if (r) {
    try {
      const b = Buffer.from(r.wrapped_key, 'base64');
      const d = crypto.createDecipheriv('aes-256-gcm', key, b.subarray(0, 12));
      d.setAuthTag(b.subarray(12, 28));
      Buffer.concat([d.update(b.subarray(28)), d.final()]);
    } catch { return false; }
  }
  await rememberFingerprint(key);  // first key: remember it
  return true;
}

async function rememberFingerprint(key: Buffer) {
  await pool.query(
    `INSERT INTO master_key_state (id, fingerprint) VALUES (true, $1)
     ON CONFLICT (id) DO UPDATE SET fingerprint = EXCLUDED.fingerprint, updated_at = now()`, [fingerprint(key)]);
}

export type KeyStatus = { unlocked: boolean; storedOnServer: boolean; source: 'server' | 'memory' | null };

export function keyStatus(): KeyStatus {
  currentKey();
  return { unlocked: !!held.key, storedOnServer: readKeyFile() !== null, source: held.source };
}

/** True when the key isn't kept on the server: what the privacy wording depends on. */
export const keyHeldOffline = () => readKeyFile() === null;

type Result = { ok: true } | { ok: false; error: string };

export async function unlock(text: string, userId: string): Promise<Result> {
  const key = parse(text ?? '');
  if (!key || !(await matches(key))) { await record('failed', userId); return { ok: false, error: 'That isn’t the master key.' }; }
  held.key = key; held.source = 'memory'; held.tried = true;
  await record('unlocked', userId);
  return { ok: true };
}

/** Forget the key until it is supplied again (only when it isn't stored on the server). */
export async function lock(userId: string, forget: () => void): Promise<Result> {
  if (readKeyFile()) return { ok: false, error: 'The key is stored on this server, so locking would not last. Remove it from the server first.' };
  held.key?.fill(0);
  held.key = null; held.source = null;
  forget();
  await record('locked', userId);
  return { ok: true };
}

/** Keep the key in a file on this server, so restarts need nobody. */
export async function storeOnServer(userId: string): Promise<Result> {
  const key = currentKey();
  if (!key) return { ok: false, error: 'Unlock first.' };
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true, mode: 0o700 });
  fs.writeFileSync(KEY_FILE, key.toString('base64') + '\n', { mode: 0o600 });
  held.source = 'server';
  await rememberFingerprint(key);
  await record('stored', userId);
  return { ok: true };
}

/** Delete the key file. The caller must paste the key back, which proves they hold a correct copy. */
export async function removeFromServer(confirmText: string, userId: string): Promise<Result> {
  const key = parse(confirmText ?? '');
  const current = currentKey();
  if (!key || !current || !key.equals(current)) {
    await record('failed', userId);
    return { ok: false, error: 'Paste your saved copy of the key: it must match exactly before the server copy is deleted.' };
  }
  await rememberFingerprint(key);
  fs.rmSync(KEY_FILE, { force: true });
  held.source = 'memory';
  await record('removed', userId);
  return { ok: true };
}

/** Show the key so it can be saved offline. Logged. */
export async function reveal(userId: string): Promise<string | null> {
  const key = currentKey();
  if (!key) return null;
  await record('revealed', userId);
  return key.toString('base64');
}

export async function keyLog(limit = 20) {
  const { rows } = await pool.query(
    `SELECT l.id, l.action, l.created_at, u.user_handle AS handle
     FROM master_key_log l LEFT JOIN users u ON u.id = l.user_id
     ORDER BY l.created_at DESC LIMIT $1`, [limit]);
  return rows;
}
