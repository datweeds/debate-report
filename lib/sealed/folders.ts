// Sealed document folders: a sealed folder covers everything below it (its
// sub-folders' names and every document in them). Server-only.

import pool from '../db';
import type { SealedItem } from './server';

type F = { id: string; parent_id: string | null; protection: string; sealed_epoch: number | null };

/** For every folder of a Society: the sealed folder it's in (itself, or the nearest sealed parent), if any. */
export async function sealRoots(societyId: number): Promise<Map<string, SealedItem | null>> {
  const { rows } = await pool.query<F>(
    'SELECT id, parent_id, protection, sealed_epoch FROM document_folders WHERE customer_id = $1', [societyId]);
  const byId = new Map(rows.map(r => [r.id, r]));
  const out = new Map<string, SealedItem | null>();
  const rootOf = (f: F | undefined, depth = 0): SealedItem | null => {
    if (!f || depth > 50) return null;
    if (out.has(f.id)) return out.get(f.id)!;
    const r = f.protection === 'sealed'
      ? { type: 'folder' as const, id: f.id, societyId, epoch: f.sealed_epoch ?? 1 }
      : rootOf(f.parent_id ? byId.get(f.parent_id) : undefined, depth + 1);
    out.set(f.id, r);
    return r;
  };
  for (const r of rows) rootOf(r);
  return out;
}

/** The sealed folder a folder is in (null for the top level, or if none). */
export async function sealRootOf(societyId: number, folderId: string | null): Promise<SealedItem | null> {
  if (!folderId) return null;
  return (await sealRoots(societyId)).get(folderId) ?? null;
}

/** A folder and every folder below it. */
export async function folderTree(societyId: number, folderId: string): Promise<string[]> {
  const { rows } = await pool.query(
    `WITH RECURSIVE down AS (
       SELECT id FROM document_folders WHERE id = $1 AND customer_id = $2
       UNION ALL SELECT f.id FROM document_folders f JOIN down ON f.parent_id = down.id)
     SELECT id FROM down`, [folderId, societyId]);
  return rows.map(r => r.id);
}
