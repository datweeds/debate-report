// Formal ballots: AGMs, elections and constitutional votes. Server-only.
//
// On top of an ordinary poll (secret ballot, encryption, receipts, audit log,
// recount), a formal ballot has:
//   - a voter roll fixed when voting opens: the members at that moment, and the
//     access codes made by then; nobody else can vote;
//   - a quorum (share of the roll that must vote) and a majority rule for motions;
//   - scrutineers: members who oversee it without being able to change it;
//   - a certified result: a document of the result and the checks, its SHA-256,
//     and an RFC 3161 timestamp of that hash from an independent authority
//     (only the hash is sent), so anyone can later show the result is unchanged.

import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { NextResponse } from 'next/server';
import pool from '../db';
import { openText, sealText } from '../societyCrypto';
import { entitlementsFor, planRefusal } from '../plans';
import { auditLog, results, verifyPoll, type PollResults, type PollRow } from './server';
import type { QuestionTally } from './tally';

export const MAJORITIES = {
  simple: { label: 'more than half', test: (yes: number, cast: number) => yes * 2 > cast },
  two_thirds: { label: 'at least two-thirds', test: (yes: number, cast: number) => yes * 3 >= cast * 2 },
  three_quarters: { label: 'at least three-quarters', test: (yes: number, cast: number) => yes * 4 >= cast * 3 },
} as const;
export type Majority = keyof typeof MAJORITIES;

export type FormalSettings = { formal: boolean; quorum_pct: number | null; majority: Majority };

/** Problems with making a poll formal: the plan, sealed polls, quizzes. */
export async function formalProblem(societyId: number, s: { formal: boolean; is_quiz: boolean; sealed: boolean }): Promise<NextResponse | null> {
  if (!s.formal) return null;
  const ent = await entitlementsFor(societyId);
  if (ent.enforced && !ent.limits.formalBallots) return planRefusal(`Formal ballots are on the Network plan; this Society is on ${ent.name}.`);
  if (s.sealed) return NextResponse.json({ error: 'A sealed poll can’t be a formal ballot: its result is counted in members’ browsers, so it can’t be certified' }, { status: 400 });
  if (s.is_quiz) return NextResponse.json({ error: 'A quiz can’t be a formal ballot' }, { status: 400 });
  return null;
}

// ── The voter roll ───────────────────────────────────────────────────────────

/** Fix the roll as voting opens: current members (if members vote) and unrevoked codes. */
export async function fixRoll(client: PoolClient, poll: PollRow) {
  if (poll.members_may_vote) {
    await client.query(
      `INSERT INTO poll_roll (poll_id, voter_key, user_id)
       SELECT $1, 'm:' || u.id, u.id FROM users u
       WHERE u.id::text IN (SELECT user_id::text FROM customer_members WHERE customer_id = $2
                            UNION SELECT user_id::text FROM customer_roles WHERE tenant_id = $2 AND role = 'customer_admin')
         AND u.user_status IS DISTINCT FROM 'closed'
       ON CONFLICT DO NOTHING`, [poll.id, poll.customer_id]);
  }
  if (poll.allow_codes) {
    await client.query(
      `INSERT INTO poll_roll (poll_id, voter_key, code_id)
       SELECT $1, 'c:' || id, id FROM poll_codes WHERE poll_id = $1 AND revoked_at IS NULL
       ON CONFLICT DO NOTHING`, [poll.id]);
  }
}

export async function onRoll(q: Pick<PoolClient, 'query'>, pollId: string, voterKey: string): Promise<boolean> {
  const { rows } = await q.query('SELECT 1 FROM poll_roll WHERE poll_id = $1 AND voter_key = $2', [pollId, voterKey]);
  return rows.length > 0;
}

/** The roll's size (a code revoked after opening no longer counts). */
export async function rollSize(pollId: string): Promise<{ total: number; members: number; codes: number }> {
  const { rows: [r] } = await pool.query(
    `SELECT count(*) FILTER (WHERE r.user_id IS NOT NULL OR r.voter_key LIKE 'm:%')::int AS members,
            count(*) FILTER (WHERE r.voter_key LIKE 'c:%' AND c.revoked_at IS NULL)::int AS codes
     FROM poll_roll r LEFT JOIN poll_codes c ON c.id = r.code_id WHERE r.poll_id = $1`, [pollId]);
  return { total: r.members + r.codes, members: r.members, codes: r.codes };
}

// ── Scrutineers ──────────────────────────────────────────────────────────────

export async function isScrutineer(pollId: string, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const { rows } = await pool.query('SELECT 1 FROM poll_scrutineers WHERE poll_id = $1 AND user_id = $2', [pollId, userId]);
  return rows.length > 0;
}

export async function scrutineers(pollId: string): Promise<{ id: string; handle: string }[]> {
  const { rows } = await pool.query(
    `SELECT u.id, u.user_handle AS handle FROM poll_scrutineers s JOIN users u ON u.id = s.user_id WHERE s.poll_id = $1 ORDER BY u.user_handle`, [pollId]);
  return rows;
}

// ── Outcomes ─────────────────────────────────────────────────────────────────

export type QuestionOutcome = {
  questionId: string; text: string;
  outcome: 'carried' | 'not_carried' | 'elected' | 'tied' | 'no_votes' | 'see_results';
  detail: string;
};
export type Outcome = {
  turnout: { voted: number; roll: number; pct: number | null };
  quorum: { required: number | null; met: boolean | null };
  decided: boolean;                 // false when the quorum wasn't met
  questions: QuestionOutcome[];
};

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 1000) / 10 : 0);

export function outcomes(poll: PollRow & FormalSettings, tallies: QuestionTally[], roll: number, voted: number): Outcome {
  const rule = MAJORITIES[poll.majority] ?? MAJORITIES.simple;
  const turnoutPct = roll ? pct(voted, roll) : null;
  const met = poll.quorum_pct ? (roll ? voted * 100 >= poll.quorum_pct * roll : false) : null;
  const questions = tallies.map((t): QuestionOutcome => {
    const base = { questionId: t.questionId, text: t.questionText };
    if (t.type === 'yes_no') {
      const yes = t.options?.find(o => o.id === 'yes')?.count ?? 0, no = t.options?.find(o => o.id === 'no')?.count ?? 0;
      const cast = yes + no;
      if (!cast) return { ...base, outcome: 'no_votes', detail: 'No votes were cast.' };
      return { ...base, outcome: rule.test(yes, cast) ? 'carried' : 'not_carried',
        detail: `For ${yes} (${pct(yes, cast)}%), against ${no} (${pct(no, cast)}%) of ${cast} votes cast; needs ${rule.label}.` };
    }
    if (t.type === 'single_choice' || t.type === 'rcv') {
      if (!t.responses) return { ...base, outcome: 'no_votes', detail: 'No votes were cast.' };
      const top = [...(t.options ?? [])].sort((a, b) => b.count - a.count).slice(0, 3).map(o => `${o.text} ${o.count}`).join(', ');
      if (!t.winner) return { ...base, outcome: 'tied', detail: `Tied: ${(t.tied ?? []).join(', ') || top}.` };
      return { ...base, outcome: 'elected',
        detail: t.type === 'rcv' ? `${t.winner}, after ${t.rounds?.length ?? 1} round(s) of instant runoff.` : `${t.winner}, with the most votes (${top}).` };
    }
    return { ...base, outcome: 'see_results', detail: 'See the full results.' };
  });
  return { turnout: { voted, roll, pct: turnoutPct }, quorum: { required: poll.quorum_pct, met }, decided: met !== false, questions };
}

// ── Certification ────────────────────────────────────────────────────────────

const sha256 = (b: Buffer | string) => crypto.createHash('sha256').update(b).digest();

/** DER: tag, length and where the value starts. */
function tl(buf: Buffer, off: number) {
  const tag = buf[off];
  let len = buf[off + 1], hdr = 2;
  if (len & 0x80) { const n = len & 0x7f; len = 0; for (let i = 0; i < n; i++) len = len * 256 + buf[off + 2 + i]; hdr = 2 + n; }
  return { tag, len, start: off + hdr };
}

/** An RFC 3161 timestamp of a SHA-256 digest from an independent authority. Only the hash is sent. */
export async function timestamp(digest: Buffer): Promise<{ url: string; response: string; time: Date | null } | null> {
  const url = process.env.TSA_URL ?? 'https://freetsa.org/tsr';
  if (url === 'off') return null;
  const nonce = crypto.randomBytes(8);
  nonce[0] = (nonce[0] & 0x7f) || 1;
  const req = Buffer.concat([
    Buffer.from([0x30, 0x43, 0x02, 0x01, 0x01,                                      // TimeStampReq, version 1
      0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00,   // messageImprint: SHA-256
      0x04, 0x20]), digest,
    Buffer.from([0x02, 0x08]), nonce,                                                // nonce
    Buffer.from([0x01, 0x01, 0xff]),                                                 // certReq: include the authority's certificate
  ]);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/timestamp-query' }, body: req, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) return null;
    const res = Buffer.from(await r.arrayBuffer());
    // TimeStampResp ::= SEQUENCE { status PKIStatusInfo (SEQUENCE { status INTEGER … }), timeStampToken }
    const outer = tl(res, 0), info = tl(res, outer.start), status = tl(res, info.start);
    if (outer.tag !== 0x30 || info.tag !== 0x30 || status.tag !== 0x02 || res[status.start] > 1) return null;   // 0 granted, 1 with mods
    if (!res.includes(digest)) return null;   // the token must be for our hash
    let time: Date | null = null;
    for (let i = 0; i < res.length - 17; i++) {
      if (res[i] !== 0x18 || res[i + 1] < 15 || res[i + 1] > 24) continue;
      const s = res.subarray(i + 2, i + 2 + res[i + 1]).toString('latin1');
      const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\.\d+)?Z$/.exec(s);
      if (m) { time = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] ?? ''}Z`); break; }
    }
    return { url, response: res.toString('base64'), time };
  } catch {
    return null;
  }
}

export type Certificate = { document: string; digest: string; tsa_url: string | null; tsa_time: string | null; has_timestamp: boolean; certified_at: string };

export async function certificateOf(poll: PollRow, withResponse = false): Promise<(Certificate & { tsa_response?: string | null }) | null> {
  const { rows: [c] } = await pool.query(
    'SELECT document, digest, tsa_url, tsa_response, tsa_time, certified_at FROM poll_certificates WHERE poll_id = $1', [poll.id]);
  if (!c) return null;
  return {
    document: await openText(poll.customer_id, c.document), digest: c.digest, tsa_url: c.tsa_url,
    tsa_time: c.tsa_time ? new Date(c.tsa_time).toISOString() : null, has_timestamp: !!c.tsa_response,
    certified_at: new Date(c.certified_at).toISOString(), ...(withResponse ? { tsa_response: c.tsa_response } : {}),
  };
}

/** Certify a closed formal ballot: check the count, write the result document, hash it, timestamp the hash. */
export async function certify(poll: PollRow & FormalSettings, by: string): Promise<{ ok: true; timestamped: boolean } | { ok: false; status: number; error: string }> {
  if (!poll.formal) return { ok: false, status: 400, error: 'Only a formal ballot can be certified' };
  if (poll.status !== 'closed') return { ok: false, status: 409, error: 'Close the ballot before certifying its result' };
  if (await certificateOf(poll)) return { ok: false, status: 409, error: 'This result is already certified' };
  const check = await verifyPoll(poll);
  if (!check.ok) return { ok: false, status: 409, error: 'The count check failed, so the result can’t be certified. Run “Verify” to see why.' };

  const [res, roll, audit, { rows: [soc] }, { rows: [me] }, scr] = await Promise.all([
    results(poll, false), rollSize(poll.id), auditLog(poll),
    pool.query('SELECT name FROM customers WHERE id = $1', [poll.customer_id]),
    pool.query('SELECT user_handle FROM users WHERE id = $1', [by]),
    scrutineers(poll.id),
  ]);
  const out = outcomes(poll, res.tallies, roll.total, poll.vote_count);
  const certifiedAt = new Date().toISOString();
  const doc = {
    format: 'new.vote certified ballot result, version 1',
    society: { id: poll.customer_id, name: soc?.name ?? '' },
    ballot: {
      id: poll.id, title: poll.payload.title, description: poll.payload.description ?? null,
      secret: poll.ballot_mode === 'secret', opened_at: poll.opened_at, closed_at: poll.closed_at,
      voters_could_change_vote: poll.allow_revote, access_codes: poll.allow_codes,
    },
    rules: { quorum_pct: poll.quorum_pct, majority_for_motions: MAJORITIES[poll.majority].label },
    voter_roll: { fixed_when_voting_opened: true, members: roll.members, access_codes: roll.codes, total: roll.total },
    turnout: out.turnout, quorum: out.quorum, decided: out.decided,
    outcomes: out.questions,
    results: res.tallies.map(({ comments: _c, ...t }) => t),
    audit: {
      counted_ballots: audit.counted.length, replaced_ballots: audit.replaced.length,
      receipts_sha256: sha256(audit.counted.slice().sort().join('\n')).toString('hex'),
      checks: check.checks,
    },
    scrutineers: scr.map(s => `@${s.handle}`),
    certified_by: me ? `@${me.user_handle}` : null,
    certified_at: certifiedAt,
  };
  const text = JSON.stringify(doc, null, 2);
  const digest = sha256(text);
  const ts = await timestamp(digest);
  await pool.query(
    `INSERT INTO poll_certificates (poll_id, document, digest, tsa_url, tsa_response, tsa_time, certified_by, certified_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [poll.id, await sealText(poll.customer_id, text), digest.toString('hex'), ts?.url ?? null, ts?.response ?? null, ts?.time ?? null, by, certifiedAt]);
  return { ok: true, timestamped: !!ts };
}

/** What the poll page shows of a formal ballot. Scrutineers' names only to overseers. */
export async function formalView(poll: PollRow & FormalSettings, res: PollResults | null, overseer: boolean) {
  const [roll, cert, scr] = await Promise.all([
    poll.status === 'draft' ? null : rollSize(poll.id), certificateOf(poll), overseer ? scrutineers(poll.id) : null]);
  return {
    quorum_pct: poll.quorum_pct, majority: MAJORITIES[poll.majority]?.label ?? MAJORITIES.simple.label,
    roll,
    outcome: res && poll.status === 'closed' && roll ? outcomes(poll, res.tallies, roll.total, poll.vote_count) : null,
    certified: cert ? { digest: cert.digest, certified_at: cert.certified_at, tsa_time: cert.tsa_time, has_timestamp: cert.has_timestamp } : null,
    scrutineers: scr,
  };
}

/** Add an independent timestamp later, if the authority couldn't be reached when certifying. */
export async function retimestamp(poll: PollRow): Promise<boolean> {
  const c = await certificateOf(poll);
  if (!c || c.has_timestamp) return false;
  const ts = await timestamp(Buffer.from(c.digest, 'hex'));
  if (!ts) return false;
  await pool.query('UPDATE poll_certificates SET tsa_url = $2, tsa_response = $3, tsa_time = $4 WHERE poll_id = $1', [poll.id, ts.url, ts.response, ts.time]);
  return true;
}
