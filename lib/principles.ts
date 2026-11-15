// Society Principles: versions and validation. Server-only.

import pool from './db';
import type { PoolClient } from 'pg';

export const CATEGORIES = ['rule', 'aspiration', 'guideline'] as const;
export type Category = typeof CATEGORIES[number];

type Q = Pick<PoolClient, 'query'>;

export async function currentVersion(customerId: number, q: Q = pool): Promise<{ id: string; version: number } | null> {
  const { rows: [v] } = await q.query(
    'SELECT id, version FROM society_principle_versions WHERE customer_id = $1 AND is_current', [customerId],
  );
  return v ?? null;
}

// The current version, creating version 1 the first time principles are added.
export async function ensureCurrentVersion(customerId: number, userId: string, q: Q = pool) {
  const v = await currentVersion(customerId, q);
  if (v) return v;
  const { rows: [nv] } = await q.query(
    `INSERT INTO society_principle_versions (customer_id, version, is_current, created_by, change_note)
     VALUES ($1, 1, TRUE, $2, 'First version') RETURNING id, version`,
    [customerId, userId],
  );
  return nv as { id: string; version: number };
}

export function readPrinciple(body: Record<string, unknown>):
  { ok: true; category: Category; title: string; body: string; grounding: string | null; section: string | null } | { ok: false; error: string } {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!title) return { ok: false, error: 'A title is required' };
  if (!text) return { ok: false, error: 'Describe the principle' };
  const category = CATEGORIES.includes(body.category as Category) ? body.category as Category : 'rule';
  return {
    ok: true, category, title: title.slice(0, 200), body: text.slice(0, 5000),
    grounding: typeof body.grounding === 'string' && body.grounding.trim() ? body.grounding.trim().slice(0, 3000) : null,
    section: typeof body.section === 'string' && body.section.trim() ? body.section.trim().slice(0, 80) : null,
  };
}

// A principle in the Society's current version (only the current version is editable).
export async function currentPrinciple(customerId: number, principleId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(principleId)) return null;
  const { rows: [p] } = await pool.query(
    `SELECT p.id, p.lineage_id, p.title, p.body, p.grounding, p.sort_order, p.version_id
     FROM society_principles p JOIN society_principle_versions v ON v.id = p.version_id
     WHERE p.id = $1 AND v.customer_id = $2 AND v.is_current`,
    [principleId, customerId],
  );
  return p ?? null;
}
