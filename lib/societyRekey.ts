// Re-encrypting Society content: when documents move or are copied to
// another Society (its key, its privacy), and when a Society switches between
// public and private. Server-only.

import { readFile, writeFile } from 'fs/promises';
import type { PoolClient } from 'pg';
import pool from './db';
import { storedPath } from './documents';
import { forgetSociety, isPrivateSociety, isSealed, LOCKED_TEXT, openFile, openText, sealFile, sealText, UNREADABLE } from './societyCrypto';
import { requireKey } from './masterKey';
import { reencryptSocietyDebates } from './debateCrypto';

type Q = Pick<PoolClient, 'query'>;

// Decrypt with one Society's key; store as the other Society requires
async function recrypt(from: number, to: number, v: string | null): Promise<string | null> {
  if (isSealed(v)) requireKey();  // locked: stop, rather than store the "locked" placeholder
  const plain = await openText(from, v);
  return sealText(to, plain);
}

async function recryptFile(from: number, to: number, storedName: string) {
  const file = storedPath(to, storedName);
  const data = await readFile(file).catch(() => null);
  if (!data) return;
  const out = await sealFile(to, await openFile(from, data), await isPrivateSociety(to));
  if (!out.equals(data)) await writeFile(file, out);
}

/** After a row moved or was copied from Society `from` to `to`: re-encrypt its text columns for `to`. */
export async function recryptRow(q: Q, table: string, id: string, cols: string[], from: number, to: number) {
  const { rows: [r] } = await q.query(`SELECT ${cols.join(', ')} FROM ${table} WHERE id = $1`, [id]);
  if (!r) return;
  const vals = [];
  for (const c of cols) vals.push(await recrypt(from, to, r[c]));
  await q.query(`UPDATE ${table} SET ${cols.map((c, n) => `${c} = $${n + 2}`).join(', ')} WHERE id = $1`, [id, ...vals]);
}

/** After a document row and its file moved or were copied from Society `from` to `to`. */
export async function recryptDocument(q: Q, docId: string, from: number, to: number) {
  const { rows: [d] } = await q.query('SELECT title, description, url, file_name, stored_name FROM documents WHERE id = $1', [docId]);
  if (!d) return;
  await q.query('UPDATE documents SET title = $2, description = $3, url = $4, file_name = $5 WHERE id = $1', [
    docId, await recrypt(from, to, d.title), await recrypt(from, to, d.description),
    await recrypt(from, to, d.url), await recrypt(from, to, d.file_name),
  ]);
  if (d.stored_name) await recryptFile(from, to, d.stored_name);
}

// Every encrypted-at-rest column: table, key, columns, and SQL for its Society
// (always: encrypted whatever the Society's privacy, e.g. poll ballots)
const TARGETS: { table: string; cols: string[]; society: string; join?: string; always?: boolean }[] = [
  // Discussions are members-only in every Society, so always encrypted
  { table: 'discussion_threads', cols: ['title'], society: 't.customer_id', always: true },
  { table: 'society_polls', cols: ['payload'], society: 't.customer_id' },
  { table: 'poll_ballots', cols: ['response'], society: 'sp.customer_id', join: 'JOIN society_polls sp ON sp.id = t.poll_id', always: true },
  { table: 'poll_codes', cols: ['label'], society: 'sp.customer_id', join: 'JOIN society_polls sp ON sp.id = t.poll_id', always: true },
  { table: 'discussion_posts', cols: ['body'], society: 'th.customer_id', join: 'JOIN discussion_threads th ON th.id = t.thread_id', always: true },
  { table: 'documents', cols: ['title', 'description', 'url', 'file_name'], society: 't.customer_id' },
  { table: 'document_folders', cols: ['name'], society: 't.customer_id' },
  { table: 'society_events', cols: ['title', 'description', 'location'], society: 't.customer_id' },
  { table: 'society_principles', cols: ['title', 'body', 'grounding', 'section'], society: 'v.customer_id',
    join: 'JOIN society_principle_versions v ON v.id = t.version_id' },
  { table: 'society_principle_versions', cols: ['change_note'], society: 't.customer_id' },
  { table: 'society_principle_reviews', cols: ['request_text'], society: 't.customer_id' },
  { table: 'projects', cols: ['name', 'description'], society: 't.customer_id' },
  { table: 'project_tasks', cols: ['name', 'description', 'comments'], society: 'p.customer_id', join: 'JOIN projects p ON p.id = t.project_id' },
  { table: 'project_status_reports', cols: ['body'], society: 'p.customer_id',
    join: 'JOIN project_tasks k ON k.id = t.task_id JOIN projects p ON p.id = k.project_id' },
  { table: 'project_raid', cols: ['name', 'description'], society: 'p.customer_id', join: 'JOIN projects p ON p.id = t.project_id' },
  { table: 'content_alerts', cols: ['flagged_text', 'original_content', 'appeal_body'], society: 'COALESCE(t.customer_id, r.customer_id)',
    join: 'LEFT JOIN statements r ON r.id = t.resolution_id' },
];

/**
 * Bring a Society's stored content in line with its current visibility:
 * encrypt everything when private, decrypt when public. Safe to run again.
 */
export async function reencryptSociety(customerId: number): Promise<number> {
  requireKey();  // never run locked: content would be overwritten with the "locked" placeholder
  forgetSociety(customerId);
  const priv = await isPrivateSociety(customerId);
  let changed = 0;
  for (const t of TARGETS) {
    const { rows } = await pool.query(
      `SELECT t.id, ${t.cols.map(c => `t.${c}`).join(', ')} FROM ${t.table} t ${t.join ?? ''} WHERE ${t.society} = $1`, [customerId]);
    for (const r of rows) {
      const vals: (string | null)[] = [];
      let diff = false;
      for (const c of t.cols) {
        const plain = await openText(customerId, r[c]);
        // Couldn't be decrypted: leave it exactly as it is
        if (isSealed(r[c]) && (plain === UNREADABLE || plain === LOCKED_TEXT)) { vals.push(r[c]); continue; }
        const seal = priv || !!t.always;
        // Already encrypted for this Society and should stay so: leave it
        const next = seal && isSealed(r[c]) && r[c].startsWith(`enc2:${customerId}:`) ? r[c] : await sealText(customerId, plain, seal);
        vals.push(next);
        if (next !== r[c]) diff = true;
      }
      if (diff) {
        await pool.query(`UPDATE ${t.table} SET ${t.cols.map((c, n) => `${c} = $${n + 2}`).join(', ')} WHERE id = $1`, [r.id, ...vals]);
        changed++;
      }
    }
  }
  changed += await reencryptSocietyDebates(customerId);
  const { rows: files } = await pool.query('SELECT stored_name FROM documents WHERE customer_id = $1 AND stored_name IS NOT NULL', [customerId]);
  for (const f of files) {
    const file = storedPath(customerId, f.stored_name);
    const data = await readFile(file).catch(() => null);
    if (!data) continue;
    const plain = await openFile(customerId, data);
    const out = priv ? await sealFile(customerId, plain, true) : plain;
    if (!out.equals(data)) { await writeFile(file, out); changed++; }
  }
  return changed;
}
