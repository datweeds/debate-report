// Sealing all of a Society's debates at once: every piece of text in them, so
// a moderator's browser can encrypt (or decrypt) it all and send it back.
// Server-only.

import type { PoolClient } from 'pg';
import pool from '../db';
import { isEndToEnd, isSealed, LOCKED_TEXT, openText, sealText, UNREADABLE } from '../societyCrypto';

type Q = Pick<PoolClient, 'query'>;

// The Society's debates, and everything in them ($1 = the Society)
const RES = `(SELECT id FROM statements WHERE customer_id = $1 AND stat_type = 'resolution')`;
const IN = `(SELECT id FROM statements WHERE id IN ${RES} OR resolution_id IN ${RES})`;

// One column of text: its table, how a row is named, and which rows belong to the Society's debates
type Col = { key: string; table: string; col: string; where: string; id?: string; json?: boolean };
const COLS: Col[] = [
  { key: 'resolution.title', table: 'statements', col: 'stat_title', where: `id IN ${RES}` },
  { key: 'resolution.description', table: 'statements', col: 'stat_description', where: `id IN ${RES}` },
  { key: 'resolution.closing', table: 'statements', col: 'closing_statement', where: `id IN ${RES}` },
  { key: 'argument.title', table: 'statements', col: 'stat_title', where: `resolution_id IN ${RES}` },
  { key: 'argument.description', table: 'statements', col: 'stat_description', where: `resolution_id IN ${RES}` },
  { key: 'chat.title', table: 'comments', col: 'comment_title', where: `statement_id IN ${IN}` },
  { key: 'chat.body', table: 'comments', col: 'comment_body', where: `statement_id IN ${IN}` },
  { key: 'chat.review', table: 'comments', col: 'moderator_review', where: `statement_id IN ${IN}` },
  { key: 'vote.rationale', table: 'stat_votes', col: 'vote_rationale', where: `statement_id IN ${IN}` },
  { key: 'fallacy.comment', table: 'statement_fallacies', col: 'fallacy_comment', where: `statement_id IN ${IN}` },
  { key: 'science.claim', table: 'science_analyses', col: 'claim', where: `statement_id IN ${IN}` },
  { key: 'science.pro', table: 'science_analyses', col: 'pro_analysis', where: `statement_id IN ${IN}` },
  { key: 'science.con', table: 'science_analyses', col: 'con_analysis', where: `statement_id IN ${IN}` },
  { key: 'science.synthesis', table: 'science_analyses', col: 'synthesis', where: `statement_id IN ${IN}` },
  { key: 'ai.results', table: 'ai_arg_sessions', col: 'results', json: true, where: `(resolution_id IN ${RES} OR statement_id IN ${IN})` },
  { key: 'quality.summary', table: 'quality_reports', col: 'ai_summary', where: `resolution_id IN ${RES}` },
  { key: 'quality.observation', table: 'quality_findings', col: 'observation', where: `report_id IN (SELECT id FROM quality_reports WHERE resolution_id IN ${RES})` },
  { key: 'quality.recommendation', table: 'quality_findings', col: 'recommendation', where: `report_id IN (SELECT id FROM quality_reports WHERE resolution_id IN ${RES})` },
  { key: 'dismissal.note', table: 'quality_dismissals', col: 'note', id: `resolution_id::text || ' ' || fingerprint`, where: `resolution_id IN ${RES}` },
  { key: 'dismissal.observation', table: 'quality_dismissals', col: 'observation', id: `resolution_id::text || ' ' || fingerprint`, where: `resolution_id IN ${RES}` },
];
const BY_KEY = new Map(COLS.map(c => [c.key, c]));

/** One stored piece of text: which column (k), which row (id), and its value (v). */
export type DebateText = { k: string; id: string; v: string };

/**
 * Every non-empty piece of text in the Society's debates. `open`: decrypted
 * from the server's encryption, for sealing; otherwise exactly as stored.
 * JSON values come as JSON text.
 */
export async function debateTexts(societyId: number, open: boolean, q: Q = pool): Promise<DebateText[]> {
  const out: DebateText[] = [];
  for (const c of COLS) {
    const { rows } = await q.query(
      `SELECT ${c.id ?? 'id'}::text AS id, ${c.col} AS v FROM ${c.table} WHERE ${c.where} AND ${c.col} IS NOT NULL`, [societyId]);
    for (const r of rows) {
      // JSON columns hold the JSON itself, or one encrypted string
      let v: string = c.json && !(typeof r.v === 'string') ? JSON.stringify(r.v) : r.v;
      if (v === '') continue;
      if (open && isSealed(v)) {
        v = await openText(null, v);
        if (v === UNREADABLE || v === LOCKED_TEXT) throw new Error('Some debate text can’t be read on the server right now');
      }
      out.push({ k: c.key, id: r.id, v });
    }
  }
  return out;
}

/** Whether `given` names exactly the text stored now (nothing missed, nothing extra). */
export function sameTexts(now: DebateText[], given: unknown): given is DebateText[] {
  if (!Array.isArray(given) || given.length !== now.length) return false;
  const want = new Set(now.map(t => `${t.k} ${t.id}`));
  const seen = new Set<string>();
  for (const g of given) {
    const name = `${g?.k} ${g?.id}`;
    if (typeof g?.v !== 'string' || !want.has(name) || seen.has(name)) return false;
    seen.add(name);
  }
  return true;
}

/**
 * Store the texts back. Sealing: each must be sealed in the browser (epoch 1).
 * Unsealing: each must be plain, and is encrypted with the Society's key.
 * Returns the problem, if any.
 */
export async function storeTexts(q: Q, societyId: number, texts: DebateText[], sealing: boolean): Promise<string | null> {
  for (const t of texts) {
    const c = BY_KEY.get(t.k)!;
    let stored: string;
    if (sealing) {
      if (t.v.length > 200000 || !/^sn1:1:[A-Za-z0-9+/]+={0,2}$/.test(t.v)) return 'Everything must be sealed';
      stored = t.v;
    } else {
      if (isEndToEnd(t.v) || isSealed(t.v)) return 'Some debate text couldn’t be unsealed';
      if (c.json) { try { JSON.parse(t.v); } catch { return 'Some AI results couldn’t be unsealed'; } }
      stored = await sealText(societyId, t.v, true);
    }
    // JSON columns: an encrypted string is stored as a JSON string; plain JSON as itself
    const value = c.json ? (isEndToEnd(stored) || isSealed(stored) ? JSON.stringify(stored) : stored) : stored;
    await q.query(`UPDATE ${c.table} SET ${c.col} = $1${c.json ? '::jsonb' : ''} WHERE ${c.id ?? 'id'}::text = $2`, [value, t.id]);
  }
  return null;
}
