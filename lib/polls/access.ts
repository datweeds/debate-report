// Who may do what with a Society's poll. Server-only.

import type { NextRequest } from 'next/server';
import pool from '../db';
import { societyContentAccess, type SocietyContentAccess } from '../societies';
import { loadPoll, memberVoter, type PollRow } from './server';
import type { PollPayload } from './types';

export type PollContext = {
  a: SocietyContentAccess;
  poll: PollRow;
  manager: boolean;      // the Society's moderators: create, run, track
  voterKey: string | null;
  canVote: boolean;
};

export async function pollContext(req: NextRequest, rawSocietyId: string, pollId: string): Promise<PollContext | null> {
  const a = await societyContentAccess(req, rawSocietyId);
  if (!a) return null;
  const poll = await loadPoll(a.societyId, pollId);
  if (!poll) return null;
  const manager = a.canModerate;
  if (poll.status === 'draft' && !manager) return null;
  const voterKey = a.session && a.isMember ? memberVoter(a.session.sub) : null;
  return { a, poll, manager, voterKey, canVote: !!voterKey && poll.members_may_vote && poll.status === 'open' };
}

/** The questions as a voter may see them: quiz answers stay hidden until the poll closes. */
export function voterPayload(poll: PollRow, manager: boolean): PollPayload {
  if (poll.sealed_payload) return poll.payload;   // sealed: opened in the browser (and never a quiz)
  if (manager || (poll.is_quiz && poll.status === 'closed')) return poll.payload;
  return { ...poll.payload, questions: poll.payload.questions.map(({ correct: _c, ...q }) => q) };
}

/** The poll's id → Society, for the code-holder routes (no Society in the URL). */
export async function pollSociety(pollId: string): Promise<number | null> {
  if (!/^[0-9a-f-]{36}$/i.test(pollId)) return null;
  const { rows: [r] } = await pool.query(
    `SELECT p.customer_id FROM society_polls p JOIN customers c ON c.id = p.customer_id
     WHERE p.id = $1 AND p.deleted_at IS NULL AND NOT ('polls' = ANY(c.disabled_sections))`, [pollId]);
  return r?.customer_id ?? null;
}

export async function memberCount(societyId: number) {
  const { rows: [r] } = await pool.query(
    `SELECT count(*)::int AS n FROM (SELECT user_id FROM customer_members WHERE customer_id = $1
       UNION SELECT user_id FROM customer_roles WHERE tenant_id = $1 AND role = 'customer_admin') m`, [societyId]);
  return r.n as number;
}

/** Settings a manager may send (validated). */
export function readSettings(b: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const pick = <T extends string>(k: string, allowed: readonly T[]) => { if (allowed.includes(b[k] as T)) out[k] = b[k]; };
  pick('close_mode', ['manual', 'fixed'] as const);
  pick('question_order', ['all_at_once', 'sequential'] as const);
  pick('result_visibility', ['live', 'after_close', 'never'] as const);
  pick('ballot_mode', ['secret', 'named'] as const);
  for (const k of ['allow_revote', 'is_quiz', 'allow_codes', 'members_may_vote']) if (typeof b[k] === 'boolean') out[k] = b[k];
  if ('closes_at' in b) {
    const t = b.closes_at ? new Date(String(b.closes_at)) : null;
    if (t && isNaN(t.getTime())) return { error: 'The closing time is not valid' } as const;
    out.closes_at = t;
  }
  return { settings: out } as const;
}
