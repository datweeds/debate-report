// Document folder names are encrypted for private Societies, so paths are
// built and sorted here rather than in SQL. Server-only.

import pool from './db';
import { openText } from './societyCrypto';

type Row = { id: string; customer_id: number; parent_id: string | null; name: string };

/** Every folder of the given Societies with its full path ("A / B / C"), sorted by path. */
export async function folderPaths(customerIds: number[]): Promise<{ id: string; customer_id: number; full_path: string }[]> {
  const { rows } = await pool.query<Row>(
    'SELECT id, customer_id, parent_id, name FROM document_folders WHERE customer_id = ANY($1::int[])', [customerIds]);
  for (const r of rows) r.name = await openText(r.customer_id, r.name);
  const byId = new Map(rows.map(r => [r.id, r]));
  const pathOf = (r: Row, depth = 0): string => {
    const parent = r.parent_id ? byId.get(r.parent_id) : undefined;
    return parent && depth < 50 ? `${pathOf(parent, depth + 1)} / ${r.name}` : r.name;
  };
  return rows.map(r => ({ id: r.id, customer_id: r.customer_id, full_path: pathOf(r) }))
    .sort((a, b) => a.full_path.localeCompare(b.full_path));
}
