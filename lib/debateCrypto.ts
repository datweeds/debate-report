// Encryption at rest for debates. Server-only.
//
// A debate is stored encrypted, with its Society's key, when the Society is
// private or the debate itself is Apply / Invite (even in a public Society).
// That covers the resolution, every argument in it, chat on it, fallacy notes,
// science analyses, AI sessions and quality reports. Votes stay as they are.
// Reading needs no Society id: encrypted values carry it (see openDeep).

import type { PoolClient } from 'pg';
import pool from './db';
import { isPrivateSociety, isSealed, LOCKED_TEXT, openDeep, openText, redactDeep, sealText, UNREADABLE } from './societyCrypto';
import { sysAdminMayAct } from './breakGlass';
import type { SessionPayload } from './auth';
import { requireKey } from './masterKey';

type Q = Pick<PoolClient, 'query'>;
type Sealing = { customerId: number | null; sealed: boolean };

const cache = new Map<string, { at: number; v: Sealing }>();
const TTL = 60_000;

/** The debate's Society, and whether its content is stored encrypted. */
export async function debateSealing(resolutionId: string | null | undefined, q: Q = pool): Promise<Sealing> {
  if (!resolutionId) return { customerId: null, sealed: false };
  const hit = cache.get(resolutionId);
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  const { rows: [r] } = await q.query('SELECT customer_id, debate_visibility FROM statements WHERE id = $1', [resolutionId]);
  const customerId: number | null = r?.customer_id ?? null;
  const v = { customerId, sealed: customerId != null && ((r.debate_visibility ?? 'public') !== 'public' || await isPrivateSociety(customerId)) };
  cache.set(resolutionId, { at: Date.now(), v });
  return v;
}

export const forgetDebate = (resolutionId: string) => { cache.delete(resolutionId); };

/** For storing text in a debate: encrypted if the debate is private. */
export async function sealDebate<T extends string | null | undefined>(resolutionId: string | null | undefined, text: T, q: Q = pool): Promise<T> {
  const s = await debateSealing(resolutionId, q);
  if (s.customerId == null) return text;
  return sealText(s.customerId, text, s.sealed);
}

/** Plain text of a stored value (for the scanner, AI review, comparisons). */
export const openDebateText = <T extends string | null | undefined>(v: T) => openText(null, v);

// Every encrypted column of a debate, keyed by its resolution
// (key: the row's identifier, when it isn't `id`; it is then unique within the debate)
type Target = { table: string; cols: string[]; json?: boolean; where: string; key?: string };
const IN_DEBATE = `(SELECT id FROM statements WHERE id = $1 OR resolution_id = $1)`;
const TARGETS: Target[] = [
  { table: 'statements', cols: ['stat_title', 'stat_description', 'closing_statement'], where: `t.id = $1` },
  { table: 'statements', cols: ['stat_title', 'stat_description'], where: `t.resolution_id = $1` },
  { table: 'comments', cols: ['comment_title', 'comment_body', 'moderator_review'], where: `t.statement_id IN ${IN_DEBATE}` },
  { table: 'statement_fallacies', cols: ['fallacy_comment'], where: `t.statement_id IN ${IN_DEBATE}` },
  { table: 'science_analyses', cols: ['claim', 'pro_analysis', 'con_analysis', 'synthesis'], where: `t.statement_id IN ${IN_DEBATE}` },
  { table: 'ai_arg_sessions', cols: ['results'], json: true, where: `(t.resolution_id = $1 OR t.statement_id IN ${IN_DEBATE})` },
  { table: 'quality_reports', cols: ['ai_summary'], where: `t.resolution_id = $1` },
  { table: 'quality_dismissals', cols: ['note', 'observation'], where: `t.resolution_id = $1`, key: 'fingerprint' },
  { table: 'quality_findings', cols: ['observation', 'recommendation'], where: `t.report_id IN (SELECT id FROM quality_reports WHERE resolution_id = $1)` },
];

/**
 * Bring one debate's stored content in line with its privacy (after its
 * visibility, or its Society's, changes, or it moves Society). Safe to rerun.
 * `from` is the Society the content is currently encrypted for, if different.
 */
export async function reencryptDebate(resolutionId: string, q: Q = pool): Promise<number> {
  requireKey();  // never run locked: content would be overwritten with the "locked" placeholder
  forgetDebate(resolutionId);
  const { customerId, sealed } = await debateSealing(resolutionId, q);
  let changed = 0;
  for (const t of TARGETS) {
    const { rows } = await q.query(`SELECT t.${t.key ?? 'id'} AS id, ${t.cols.map(c => `t.${c}`).join(', ')} FROM ${t.table} t WHERE ${t.where}`, [resolutionId]);
    for (const r of rows) {
      const vals: unknown[] = [];
      let diff = false;
      for (const c of t.cols) {
        // JSON columns hold either the JSON itself or one encrypted string
        const stored = t.json ? (isSealed(r[c]) || r[c] == null ? r[c] : JSON.stringify(r[c])) : r[c];
        const plain = await openText(null, stored);
        if (isSealed(stored) && (plain === UNREADABLE || plain === LOCKED_TEXT || plain === stored)) { vals.push(r[c]); continue; }
        let next: string | null = plain;
        // Re-seal only when needed: already sealed for the right Society stays as it is
        const sameSociety = isSealed(stored) && customerId != null && stored.startsWith(`enc2:${customerId}:`);
        if (sealed && customerId != null) next = sameSociety ? stored : await sealText(customerId, plain, true);
        if (next !== stored) {
          diff = true;
          vals.push(t.json ? (next == null ? null : isSealed(next) ? JSON.stringify(next) : next) : next);
        } else vals.push(t.json ? (r[c] == null ? null : JSON.stringify(r[c])) : r[c]);
      }
      if (diff) {
        const where = t.key ? `${t.key} = $1 AND resolution_id = $${t.cols.length + 2}` : 'id = $1';
        await q.query(`UPDATE ${t.table} SET ${t.cols.map((c, n) => `${c} = $${n + 2}${t.json ? '::jsonb' : ''}`).join(', ')} WHERE ${where}`,
          [r.id, ...vals, ...(t.key ? [resolutionId] : [])]);
        changed++;
      }
    }
  }
  return changed;
}

/** Every debate of a Society (after the Society switches between public and private). */
export async function reencryptSocietyDebates(customerId: number): Promise<number> {
  const { rows } = await pool.query(`SELECT id FROM statements WHERE customer_id = $1 AND stat_type = 'resolution'`, [customerId]);
  let n = 0;
  for (const r of rows) n += await reencryptDebate(r.id);
  return n;
}

/**
 * For Sys Admin views: decrypt only where Sys Admin may act on the row's
 * Society (public, or emergency access); elsewhere show a placeholder.
 */
export async function openForSysAdmin<R extends object>(session: SessionPayload | null, rows: R[], societyOf: (r: R) => number | null | undefined): Promise<R[]> {
  const may = new Map<number | null, boolean>();
  for (const r of rows) {
    const cid = societyOf(r) ?? null;
    if (!may.has(cid)) may.set(cid, await sysAdminMayAct(session, cid));
    await (may.get(cid) ? openDeep(r) : redactDeep(r, '🔒 Private debate'));
  }
  return rows;
}
