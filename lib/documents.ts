// Society Documents: storage on disk and upload rules. Server-only.

import path from 'path';
import crypto from 'crypto';
import { mkdir, writeFile, unlink } from 'fs/promises';
import { sealFile } from './societyCrypto';

export const STORAGE_DIR = process.env.DOCUMENTS_DIR || path.join(process.cwd(), 'storage', 'documents');

export const MEMBER_LIMIT_BYTES = 10 * 1024 * 1024;     // 10 MB
export const MODERATOR_LIMIT_BYTES = 50 * 1024 * 1024;  // 50 MB

// Types safe to show in the browser. Everything else is always downloaded,
// so an uploaded HTML or script file can never run on our domain.
export const INLINE_TYPES = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'text/plain',
]);

function societyDir(customerId: number) {
  return path.join(STORAGE_DIR, String(customerId));
}

export function storedPath(customerId: number, storedName: string) {
  // storedName is always ours (uuid + ext), but never trust a path segment
  return path.join(societyDir(customerId), path.basename(storedName));
}

export async function saveFile(customerId: number, file: File): Promise<{ storedName: string }> {
  const ext = path.extname(file.name).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 12);
  const storedName = `${crypto.randomUUID()}${ext}`;
  await mkdir(societyDir(customerId), { recursive: true });
  // Private Societies: stored encrypted with the Society's key
  await writeFile(storedPath(customerId, storedName), await sealFile(customerId, Buffer.from(await file.arrayBuffer())));
  return { storedName };
}

/** A file already encrypted in a member's browser (a sealed folder): stored exactly as it came. */
export async function saveSealedBytes(customerId: number, data: Buffer): Promise<{ storedName: string }> {
  const storedName = `${crypto.randomUUID()}.sn1`;
  await mkdir(societyDir(customerId), { recursive: true });
  await writeFile(storedPath(customerId, storedName), data);
  return { storedName };
}

export const isBrowserSealed = (b: Buffer) => b.length > 32 && b.subarray(0, 4).toString('latin1') === 'SN1F';

export async function removeFile(customerId: number, storedName: string | null) {
  if (storedName) await unlink(storedPath(customerId, storedName)).catch(() => {});
}

export function isHttpUrl(s: unknown): s is string {
  if (typeof s !== 'string' || s.length > 2000) return false;
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(/\.0$/, '')} MB`;
}
