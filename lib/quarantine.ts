import crypto from 'crypto';
import path from 'path';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import pool from './db';
import { currentKey, requireKey } from './masterKey';

// Images refused at upload as sexually explicit are held here so the platform
// team can judge them and, for child sexual abuse material, report them to the
// NCA. Encrypted with a key derived from the master key (held offline), so a
// copy of the server can't read them. Kept out of backups. Deleted after 30
// days, or a year after an NCA report (the CSEA reporting rules).
export const QUARANTINE_DIR = process.env.QUARANTINE_DIR || path.join(process.cwd(), 'storage', 'quarantine');
export const QUARANTINE_DAYS = 30;
const MAGIC = Buffer.from('NVQ1');

const derivedKey = (master: Buffer) =>
  Buffer.from(crypto.hkdfSync('sha256', master, Buffer.alloc(0), Buffer.from('new.vote quarantine v1'), 32));

function encrypt(data: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', derivedKey(requireKey()), iv);
  const body = Buffer.concat([c.update(data), c.final()]);
  return Buffer.concat([MAGIC, iv, c.getAuthTag(), body]);
}

function decrypt(blob: Buffer): Buffer {
  if (!blob.subarray(0, 4).equals(MAGIC)) throw new Error('not a quarantined file');
  const iv = blob.subarray(4, 16), tag = blob.subarray(16, 32);
  const d = crypto.createDecipheriv('aes-256-gcm', derivedKey(requireKey()), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(blob.subarray(32)), d.final()]);
}

const fileFor = (name: string) => path.join(QUARANTINE_DIR, path.basename(name));

/** Hold a refused image for review. False if it couldn't be held (the master key isn't loaded). */
export async function quarantineImage(alertId: string, bytes: Buffer, mime: string): Promise<boolean> {
  if (!currentKey()) return false;
  const name = `${crypto.randomUUID()}.nvq`;
  await mkdir(QUARANTINE_DIR, { recursive: true, mode: 0o700 });
  await writeFile(fileFor(name), encrypt(bytes), { mode: 0o600 });
  await pool.query(
    `INSERT INTO quarantined_images (alert_id, stored_name, mime_type, size_bytes, delete_after)
     VALUES ($1, $2, $3, $4, now() + make_interval(days => $5))`,
    [alertId, name, mime.slice(0, 100) || 'application/octet-stream', bytes.length, QUARANTINE_DAYS]);
  return true;
}

/** The image, for a Sys Admin to judge. Each look is counted. */
export async function openQuarantined(alertId: string, viewerId: string): Promise<{ bytes: Buffer; mime: string } | null> {
  const { rows: [q] } = await pool.query('SELECT stored_name, mime_type FROM quarantined_images WHERE alert_id = $1', [alertId]);
  if (!q) return null;
  const bytes = decrypt(await readFile(fileFor(q.stored_name)));
  await pool.query('UPDATE quarantined_images SET views = views + 1, last_viewed_at = now(), last_viewed_by = $2 WHERE alert_id = $1', [alertId, viewerId]);
  const mime = /^image\/(jpeg|png|gif|webp)$/.test(q.mime_type) ? q.mime_type : 'application/octet-stream';
  return { bytes, mime };
}

async function remove(rows: { stored_name: string }[]) {
  for (const r of rows) await unlink(fileFor(r.stored_name)).catch(() => {});
}

/** Delete now: judged not to be child sexual abuse material. */
export async function discardQuarantined(alertId: string): Promise<boolean> {
  const { rows } = await pool.query('DELETE FROM quarantined_images WHERE alert_id = $1 RETURNING stored_name', [alertId]);
  await remove(rows);
  return rows.length > 0;
}

/** Reported to the NCA: keep for a year from the report, as the reporting rules require. */
export async function markReported(alertId: string, reference: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE quarantined_images SET nca_reference = $2, reported_at = now(), delete_after = now() + interval '1 year' WHERE alert_id = $1`,
    [alertId, reference.slice(0, 120)]);
  return (rowCount ?? 0) > 0;
}

/** Hourly: delete anything past its time. */
export async function purgeQuarantine(): Promise<number> {
  const { rows } = await pool.query('DELETE FROM quarantined_images WHERE delete_after < now() RETURNING stored_name');
  await remove(rows);
  return rows.length;
}
