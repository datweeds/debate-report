// Society dashboard image (customers.hero_image): upload and removal, shared by
// the SysAdmin and Moderator routes. Server-only.

import { writeFile, mkdir, unlink } from 'fs/promises';
import { screenImageUpload } from './imageScan';
import path from 'path';
import pool from './db';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
};
const UPLOAD_PREFIX = '/uploads/societies/';
const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'societies');

// Delete a previously uploaded file — only ever one of ours, never an
// arbitrary path that happens to be stored in hero_image.
async function removeOld(imagePath: string | null) {
  if (!imagePath?.startsWith(UPLOAD_PREFIX)) return;
  await unlink(path.join(uploadsDir, path.basename(imagePath))).catch(() => {});
}

async function currentImage(id: number): Promise<{ found: boolean; image: string | null }> {
  const { rows } = await pool.query('SELECT hero_image FROM customers WHERE id = $1', [id]);
  return { found: rows.length > 0, image: rows[0]?.hero_image ?? null };
}

export async function saveSocietyImage(id: number, file: File | null, userId: string | null = null):
  Promise<{ ok: true; imagePath: string } | { ok: false; status: number; error: string }> {
  const current = await currentImage(id);
  if (!current.found) return { ok: false, status: 404, error: 'Society not found' };
  if (!file) return { ok: false, status: 400, error: 'No image provided' };
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return { ok: false, status: 400, error: 'Image must be JPEG, PNG or WebP' };
  if (file.size > MAX_BYTES) return { ok: false, status: 400, error: 'Image must be 5 MB or smaller' };

  // Timestamped name so browsers never show a cached older image.
  const bytes = Buffer.from(await file.arrayBuffer());
  const screen = await screenImageUpload({ bytes, mime: file.type, fileName: file.name, userId, societyId: id, where: 'Society picture' });
  if (!screen.ok) return { ok: false, status: 422, error: screen.error };
  const filename = `${id}-${Date.now()}.${ext}`;
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(path.join(uploadsDir, filename), bytes);

  const imagePath = `${UPLOAD_PREFIX}${filename}`;
  await pool.query('UPDATE customers SET hero_image = $1, updated_at = now() WHERE id = $2', [imagePath, id]);
  await removeOld(current.image);
  return { ok: true, imagePath };
}

export async function clearSocietyImage(id: number): Promise<boolean> {
  const current = await currentImage(id);
  if (!current.found) return false;
  await pool.query('UPDATE customers SET hero_image = NULL, updated_at = now() WHERE id = $1', [id]);
  await removeOld(current.image);
  return true;
}
