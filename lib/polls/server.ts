// Society Polls on the server: loading, casting and counting ballots. Server-only.
//
// Secrecy: who voted (poll_participants) and what was voted (poll_ballots)
// are stored apart. A secret ballot's only link to its voter is a token keyed
// by the master key, so the voter can replace it while the poll is open but a
// copy of the database can't connect the two. Ballots are always encrypted
// with the Society's key; secret ballots carry no timestamp.

import crypto from 'crypto';
import { sealedFor, type SealedItem } from '../sealed/server';
import type { PoolClient } from 'pg';
import pool from '../db';
import { requireKey } from '../masterKey';
import { openText, sealText } from '../societyCrypto';
import { quizScore, tally, validateBallot, type QuestionTally } from './tally';
import type { Answer, PollPayload, PollSettings } from './types';

export type PollRow = PollSettings & {
  id: string; customer_id: number; payload: PollPayload; vote_count: number;
  opened_at: string | null; closed_at: string | null; created_at: string; created_by: string | null;
  protection: 'server' | 'sealed'; sealed_epoch: number | null; question_count: number | null;
  sealed_payload: string | null;   // a sealed poll's questions, encrypted in members' browsers
};

/** The sealed poll as a sealed item (its key, its epoch), or null. */
export const pollItem = (p: PollRow): SealedItem | null =>
  p.protection === 'sealed' ? { type: 'poll', id: p.id, societyId: p.customer_id, epoch: p.sealed_epoch ?? 1 } : null;

const COLS = `id, customer_id, payload, status, close_mode, closes_at, opened_at, closed_at, question_order, questions_revealed,
  result_visibility, ballot_mode, allow_revote, is_quiz, allow_codes, members_may_vote, vote_count, created_at, created_by,
  protection, sealed_epoch, question_count`;

async function hydrate(r: Record<string, unknown>): Promise<PollRow> {
  // Sealed: the questions can only be read in members' browsers
  if (String(r.payload).startsWith('sn1:')) {
    return { ...(r as unknown as PollRow), payload: { title: 'Sealed poll', questions: [] }, sealed_payload: r.payload as string };
  }
  const text = await openText(r.customer_id as number, r.payload as string);
  let payload: PollPayload;
  try { payload = JSON.parse(text); } catch { payload = { title: text.startsWith('🔒') ? text : 'Unreadable poll', questions: [] }; }
  return { ...(r as unknown as PollRow), payload, sealed_payload: null };
}

/** A poll of this Society (not deleted). Closes it first if its closing time has passed. */
export async function loadPoll(customerId: number, pollId: string): Promise<PollRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(pollId)) return null;
  await pool.query(
    `UPDATE society_polls SET status = 'closed', closed_at = closes_at
     WHERE id = $1 AND status = 'open' AND close_mode = 'fixed' AND closes_at <= now()`, [pollId]);
  const { rows: [r] } = await pool.query(
    `SELECT ${COLS} FROM society_polls WHERE id = $1 AND customer_id = $2 AND deleted_at IS NULL`, [pollId, customerId]);
  return r ? hydrate(r) : null;
}

export async function listPolls(customerId: number, withDrafts: boolean): Promise<PollRow[]> {
  await pool.query(
    `UPDATE society_polls SET status = 'closed', closed_at = closes_at
     WHERE customer_id = $1 AND status = 'open' AND close_mode = 'fixed' AND closes_at <= now()`, [customerId]);
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM society_polls WHERE customer_id = $1 AND deleted_at IS NULL ${withDrafts ? '' : `AND status <> 'draft'`}
     ORDER BY (status = 'open') DESC, COALESCE(opened_at, created_at) DESC`, [customerId]);
  return Promise.all(rows.map(hydrate));
}

export const sealPayload = (customerId: number, p: PollPayload) => sealText(customerId, JSON.stringify(p));

/** How many questions a voter can answer now. */
export const questionCount = (p: PollRow) => (p.sealed_payload ? p.question_count ?? 0 : p.payload.questions.length);
export const openQuestions = (p: PollRow) =>
  p.question_order === 'sequential' ? Math.min(p.questions_revealed, questionCount(p)) : questionCount(p);

// ── Voters and ballots ───────────────────────────────────────────────────────

export const memberVoter = (userId: string) => `m:${userId}`;
export const codeVoter = (codeId: string) => `c:${codeId}`;

/** The ballot's link to its voter: a keyed token for secret polls, the voter itself for named ones. */
function ballotToken(poll: PollRow, voterKey: string): string {
  if (poll.ballot_mode === 'named') return voterKey;
  const sub = crypto.createHmac('sha256', requireKey()).update('new.vote poll ballot token v1').digest();
  return crypto.createHmac('sha256', sub).update(`${poll.id}:${voterKey}`).digest('hex');
}

export async function hasVoted(pollId: string, voterKey: string) {
  const { rows } = await pool.query('SELECT 1 FROM poll_participants WHERE poll_id = $1 AND voter_key = $2', [pollId, voterKey]);
  return rows.length > 0;
}

/** The voter's own current ballot (to change it, or see what they sent). */
export async function myBallot(poll: PollRow, voterKey: string): Promise<Answer[] | string | null> {
  const { rows: [b] } = await pool.query(
    'SELECT response FROM poll_ballots WHERE poll_id = $1 AND ballot_token = $2 AND NOT superseded', [poll.id, ballotToken(poll, voterKey)]);
  if (!b) return null;
  if (poll.sealed_payload) return b.response as string;   // sealed: opened in the voter's browser
  try { return JSON.parse(await openText(poll.customer_id, b.response)); } catch { return null; }
}

type CastResult = { ok: true; revoted: boolean } | { ok: false; status: number; error: string };

/**
 * Record a ballot. In one transaction: the poll is locked, the voter is
 * checked (and recorded as having voted), any earlier ballot of theirs is
 * marked replaced, and the new one stored encrypted.
 */
export async function castBallot(poll: PollRow, voter: { key: string; userId?: string; codeId?: string }, rawAnswers: unknown, receiptHash: unknown): Promise<CastResult> {
  if (typeof receiptHash !== 'string' || !/^[0-9a-f]{64}$/.test(receiptHash)) return { ok: false, status: 400, error: 'Missing vote receipt' };
  // A sealed poll's ballot arrives encrypted in the voter's browser: it's checked when counted, there
  const item = pollItem(poll);
  let response: string;
  if (item) {
    if (!sealedFor(item, rawAnswers, 3_000_000)) return { ok: false, status: 400, error: 'This sealed poll’s keys have changed: reload the page and try again' };
    response = rawAnswers as string;
  } else {
    const v = validateBallot(poll.payload, openQuestions(poll), rawAnswers);
    if (!v.ok) return { ok: false, status: 400, error: v.error };
    response = await sealText(poll.customer_id, JSON.stringify(v.ballot), true);  // always encrypted
  }
  const token = ballotToken(poll, voter.key);
  const named = poll.ballot_mode === 'named';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [p] } = await client.query(`SELECT status FROM society_polls WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [poll.id]);
    if (p?.status !== 'open') { await client.query('ROLLBACK'); return { ok: false, status: 409, error: 'This poll is not open' }; }
    if (voter.codeId) {
      const { rows: [c] } = await client.query('SELECT revoked_at FROM poll_codes WHERE id = $1 AND poll_id = $2 FOR UPDATE', [voter.codeId, poll.id]);
      if (!c || c.revoked_at) { await client.query('ROLLBACK'); return { ok: false, status: 403, error: 'This code is not valid' }; }
    }
    const { rows: [already] } = await client.query(
      'SELECT 1 FROM poll_participants WHERE poll_id = $1 AND voter_key = $2 FOR UPDATE', [poll.id, voter.key]);
    if (already) {
      if (!poll.allow_revote) { await client.query('ROLLBACK'); return { ok: false, status: 409, error: 'You have already voted in this poll' }; }
      await client.query('UPDATE poll_ballots SET superseded = TRUE WHERE poll_id = $1 AND ballot_token = $2 AND NOT superseded', [poll.id, token]);
    } else {
      await client.query(
        'INSERT INTO poll_participants (poll_id, voter_key, user_id, code_id) VALUES ($1, $2, $3, $4)',
        [poll.id, voter.key, voter.userId ?? null, voter.codeId ?? null]);
      await client.query('UPDATE society_polls SET vote_count = vote_count + 1 WHERE id = $1', [poll.id]);
      if (voter.codeId) await client.query('UPDATE poll_codes SET used_at = now() WHERE id = $1', [voter.codeId]);
    }
    await client.query(
      `INSERT INTO poll_ballots (poll_id, ballot_token, user_id, code_id, response, receipt_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [poll.id, token, named ? voter.userId ?? null : null, named ? voter.codeId ?? null : null, response, receiptHash, named ? new Date() : null]);
    await client.query('COMMIT');
    return { ok: true, revoted: !!already };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

type Counted = { answers: Answer[]; voter?: string };

/** Every counted (not replaced) ballot, decrypted. Named polls also say whose. */
export async function countedBallots(poll: PollRow, q: Pick<PoolClient, 'query'> = pool): Promise<{ ballots: Counted[]; unreadable: number }> {
  const { rows } = await q.query(
    `SELECT b.response, u.user_handle, c.label
     FROM poll_ballots b LEFT JOIN users u ON u.id = b.user_id LEFT JOIN poll_codes c ON c.id = b.code_id
     WHERE b.poll_id = $1 AND NOT b.superseded ORDER BY b.id`, [poll.id]);
  const ballots: Counted[] = [];
  let unreadable = 0;
  for (const r of rows) {
    try {
      const answers = JSON.parse(await openText(poll.customer_id, r.response)) as Answer[];
      const voter = poll.ballot_mode === 'named' ? (r.user_handle ? `@${r.user_handle}` : (await openText(poll.customer_id, r.label)) || 'Code voter') : undefined;
      ballots.push({ answers, voter });
    } catch { unreadable++; }
  }
  return { ballots, unreadable };
}

export type PollResults = {
  total: number;
  tallies: QuestionTally[];
  sealedBallots?: { response: string; voter?: string }[];   // a sealed poll: counted in the viewer's browser
  quiz?: { average: number; outOf: number; distribution: Record<string, number> };
  voters?: { voter: string; answers: Answer[]; score?: number }[];  // named polls, for managers
};

/** Results for a viewer: managers see comments and (named polls) who chose what. */
export async function results(poll: PollRow, forManager: boolean): Promise<PollResults> {
  if (poll.sealed_payload) {
    // Sealed: the ballots go to the viewer's browser to be opened and counted (names only to managers of named polls)
    const { rows } = await pool.query(
      `SELECT b.response, u.user_handle FROM poll_ballots b LEFT JOIN users u ON u.id = b.user_id
       WHERE b.poll_id = $1 AND NOT b.superseded ORDER BY ${poll.ballot_mode === 'named' ? 'b.id' : 'random()'}`, [poll.id]);
    return { total: rows.length, tallies: [], sealedBallots: rows.map(r => ({
      response: r.response, ...(forManager && poll.ballot_mode === 'named' ? { voter: r.user_handle ? `@${r.user_handle}` : 'Code voter' } : {}) })) };
  }
  const { ballots } = await countedBallots(poll);
  const all = ballots.map(b => b.answers);
  const out: PollResults = {
    total: ballots.length,
    tallies: tally(poll.payload, all, { includeComments: q => forManager || !!q.settings.commentsPublic, quiz: poll.is_quiz && (forManager || poll.status === 'closed') }),
  };
  if (poll.is_quiz && (forManager || poll.status === 'closed')) {
    const scores = all.map(b => quizScore(poll.payload, b));
    const outOf = scores[0]?.outOf ?? poll.payload.questions.filter(q => q.correct?.length).length;
    const distribution: Record<string, number> = {};
    for (const s of scores) distribution[s.score] = (distribution[s.score] ?? 0) + 1;
    out.quiz = { average: scores.length ? Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length * 10) / 10 : 0, outOf, distribution };
  }
  if (forManager && poll.ballot_mode === 'named') {
    out.voters = ballots.map(b => ({ voter: b.voter ?? '', answers: b.answers, ...(poll.is_quiz ? { score: quizScore(poll.payload, b.answers).score } : {}) }));
  }
  return out;
}

/** May this viewer see the results now? */
export const resultsVisible = (poll: PollRow, manager: boolean) =>
  manager || (poll.status !== 'draft' && (poll.result_visibility === 'live' || (poll.result_visibility === 'after_close' && poll.status === 'closed')));

/** Receipt hashes, for anyone to check their vote is in the count. */
export async function auditLog(poll: PollRow) {
  const { rows } = await pool.query(
    'SELECT receipt_hash, superseded FROM poll_ballots WHERE poll_id = $1 ORDER BY receipt_hash', [poll.id]);
  return {
    counted: rows.filter(r => !r.superseded).map(r => r.receipt_hash as string),
    replaced: rows.filter(r => r.superseded).map(r => r.receipt_hash as string),
    voters: poll.vote_count,
  };
}

/**
 * Accuracy check: every number that should agree, does. Run by managers from
 * the poll page; also exercised by the accuracy test suite.
 */
export async function verifyPoll(poll: PollRow) {
  const sealed = !!poll.sealed_payload;
  const [{ rows: [c] }, { ballots, unreadable }] = await Promise.all([
    pool.query(
      `SELECT (SELECT count(*)::int FROM poll_participants WHERE poll_id = $1) AS participants,
              (SELECT count(*)::int FROM poll_ballots WHERE poll_id = $1 AND NOT superseded) AS current,
              (SELECT count(*)::int FROM poll_ballots WHERE poll_id = $1) AS all_ballots,
              (SELECT count(DISTINCT receipt_hash)::int FROM poll_ballots WHERE poll_id = $1) AS receipts,
              (SELECT count(*)::int FROM (SELECT ballot_token FROM poll_ballots WHERE poll_id = $1 AND NOT superseded
                                          GROUP BY ballot_token HAVING count(*) > 1) d) AS duplicate_voters`, [poll.id]),
    sealed ? Promise.resolve({ ballots: [] as Counted[], unreadable: 0 }) : countedBallots(poll),
  ]);
  let invalid = 0;
  for (const b of ballots) {
    // Each counted ballot must be valid for the questions it answers
    const answered = poll.payload.questions.filter(q => b.answers.some(a => a.questionId === q.id));
    const check = validateBallot({ ...poll.payload, questions: answered }, answered.length, b.answers);
    if (!check.ok || b.answers.length !== answered.length) invalid++;
  }
  // Recount independently of the tally: simple option counts must agree
  const t = tally(poll.payload, ballots.map(b => b.answers));
  let recountMismatches = 0;
  for (const q of poll.payload.questions) {
    if (!['single_choice', 'yes_no', 'multi_choice'].includes(q.type)) continue;
    const mine: Record<string, number> = {};
    for (const b of ballots) {
      const a = b.answers.find(x => x.questionId === q.id);
      if (a) for (const id of [a.value].flat() as string[]) mine[id] = (mine[id] ?? 0) + 1;
    }
    const tq = t.find(x => x.questionId === q.id)!;
    for (const o of tq.options ?? []) if ((mine[o.id] ?? 0) !== o.count) recountMismatches++;
  }
  const checks = [
    { label: 'Voters recorded = voter count', ok: c.participants === poll.vote_count, detail: `${c.participants} / ${poll.vote_count}` },
    { label: 'Counted ballots = voters', ok: c.current === c.participants, detail: `${c.current} / ${c.participants}` },
    { label: 'No voter has two counted ballots', ok: c.duplicate_voters === 0, detail: String(c.duplicate_voters) },
    { label: 'Every receipt is unique', ok: c.receipts === c.all_ballots, detail: `${c.receipts} / ${c.all_ballots}` },
    // A sealed poll's ballots can only be opened, checked and recounted in the browser
    ...(sealed ? [] : [
      { label: 'Every ballot decrypts', ok: unreadable === 0, detail: String(unreadable) },
      { label: 'Every ballot is valid for its questions', ok: invalid === 0, detail: String(invalid) },
      { label: 'Independent recount matches', ok: recountMismatches === 0, detail: String(recountMismatches) },
    ]),
  ];
  return { ok: checks.every(x => x.ok), checks, replacedBallots: c.all_ballots - c.current };
}

// ── Access codes ─────────────────────────────────────────────────────────────

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  // no 0/O, 1/I
// A code as typed or pasted: XXXX-XXXX-XXXX, perhaps with a label or other text around it
// ("Guest one: ABCD-EFGH-JKLM"), spaces instead of hyphens, or in lower case
const CODE_IN_TEXT = /(?<![A-Z0-9])([A-HJ-NP-Z2-9]{4})[\s-]?([A-HJ-NP-Z2-9]{4})[\s-]?([A-HJ-NP-Z2-9]{4})(?![A-Z0-9])/g;
export const normaliseCode = (code: string) => {
  const upper = code.toUpperCase();
  const m = [...upper.matchAll(CODE_IN_TEXT)].at(-1);
  return m ? m[1] + m[2] + m[3] : upper.replace(/[^A-Z0-9]/g, '');
};
export const hashCode = (code: string) => crypto.createHash('sha256').update(`poll-code:${normaliseCode(code)}`).digest('hex');

/** A code of 12 characters (60 bits), shown as XXXX-XXXX-XXXX. */
export function newCode(): string {
  const bytes = crypto.randomBytes(12);
  const chars = [...bytes].map(b => ALPHABET[b % 32]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
}

/** Find a valid code for a poll (any poll if pollId is omitted). */
export async function findCode(pollId: string, code: string): Promise<{ id: string; revoked: boolean } | null> {
  const { rows: [c] } = await pool.query(
    'SELECT id, poll_id, revoked_at FROM poll_codes WHERE code_hash = $1 AND poll_id = $2', [hashCode(code), pollId]);
  return c ? { id: c.id as string, revoked: !!c.revoked_at } : null;
}

// Failed code attempts per address: slows anyone guessing codes
const attempts = new Map<string, { n: number; until: number }>();
export function codeAttemptAllowed(ip: string) {
  const a = attempts.get(ip);
  return !a || a.until < Date.now() || a.n < 10;
}
export function codeAttemptFailed(ip: string) {
  const a = attempts.get(ip);
  if (!a || a.until < Date.now()) attempts.set(ip, { n: 1, until: Date.now() + 15 * 60_000 });
  else a.n++;
}

// Voters per poll, split into members and access-code holders: turnout is
// members who voted out of all members (code holders aren't members).
export async function voterSplit(pollIds: string[]): Promise<Map<string, { members: number; codes: number }>> {
  if (!pollIds.length) return new Map();
  const { rows } = await pool.query(
    `SELECT poll_id, count(*) FILTER (WHERE voter_key LIKE 'm:%')::int AS members, count(*) FILTER (WHERE voter_key LIKE 'c:%')::int AS codes
     FROM poll_participants WHERE poll_id = ANY($1::uuid[]) GROUP BY poll_id`, [pollIds]);
  return new Map(rows.map(r => [r.poll_id as string, { members: r.members as number, codes: r.codes as number }]));
}

// Members who voted, as a share of all members (never over 100%)
export const turnoutPct = (memberVotes: number, members: number) => members > 0 ? Math.min(100, Math.round((memberVotes / members) * 100)) : null;
