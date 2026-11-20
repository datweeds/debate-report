'use client';

// A sealed poll in the browser: its questions and ballots are opened and sealed
// here with this person's key, and its results counted here, with the same
// counting code the server uses for other polls.

import { useEffect, useState } from 'react';
import { useSecureAccess } from '@/components/sealed/useSecureAccess';
import { keysFor, openItemText, sealItemText, type ItemKeys } from '@/components/sealed/items';
import { tally, validateBallot } from '@/lib/polls/tally';
import type { Answer, PollPayload } from '@/lib/polls/types';
import type { PollResults } from '@/lib/polls/server';

export const SEALED_POLL = 'Sealed poll: its questions and every ballot are end-to-end encrypted, so only members can read them, not new.vote; results are counted in your browser. Sealed polls are for members only (no access codes), can’t be quizzes, and every member who can see the results can read each (anonymous) ballot, comments included. No AI, abuse scanning or Sys Admin emergency access.';

export type SealedPoll = {
  status: 'n/a' | 'pending' | 'ready' | 'none' | 'locked' | 'error';
  keys: ItemKeys | null;
  canWrite: boolean;
};

/** The key for a sealed poll (shared and renewed as needed), once secure access is unlocked. */
export function useSealedPoll(societyId: number, pollId: string | null, sealed: boolean): SealedPoll {
  const access = useSecureAccess();
  const [keys, setKeys] = useState<ItemKeys | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!sealed || !pollId || access.status !== 'ready' || !access.identity || keys) return;
    keysFor(`/api/societies/${societyId}`, 'poll', pollId, access.identity).then(setKeys).catch(() => setError(true));
  }, [sealed, pollId, access.status, access.identity, keys, societyId]);
  const status: SealedPoll['status'] = !sealed ? 'n/a' : error ? 'error' : keys ? 'ready'
    : access.status === 'none' ? 'none' : access.status === 'locked' ? 'locked' : 'pending';
  return { status, keys, canWrite: !sealed || !!keys?.keys.has(keys.epoch) };
}

export function openPayload(keys: ItemKeys | null, sealed: string | null | undefined): PollPayload | null {
  const text = openItemText(keys, sealed);
  if (!text) return null;
  try { return JSON.parse(text) as PollPayload; } catch { return null; }
}
export const sealPayloadE2E = (keys: ItemKeys, p: PollPayload) => sealItemText(keys, JSON.stringify(p));

export function openBallot(keys: ItemKeys | null, sealed: string | null | undefined): Answer[] | null {
  const text = openItemText(keys, sealed);
  if (!text) return null;
  try { return JSON.parse(text) as Answer[]; } catch { return null; }
}
export const sealAnswers = (keys: ItemKeys, answers: Answer[]) => sealItemText(keys, JSON.stringify(answers));

/**
 * Results from the ballots the server sent, opened and checked here. A ballot
 * that won't open or doesn't fit the questions isn't counted (and is reported).
 */
export function countSealed(keys: ItemKeys | null, payload: PollPayload, sealed: NonNullable<PollResults['sealedBallots']>, manager: boolean):
  PollResults & { unreadable: number; invalid: number } {
  const ok: { answers: Answer[]; voter?: string }[] = [];
  let unreadable = 0, invalid = 0;
  for (const b of sealed) {
    const answers = openBallot(keys, b.response);
    if (!answers) { unreadable++; continue; }
    const answered = payload.questions.filter(q => answers.some(a => a.questionId === q.id));
    const check = validateBallot({ ...payload, questions: answered }, answered.length, answers);
    if (!check.ok) { invalid++; continue; }
    ok.push({ answers: check.ballot, voter: b.voter });
  }
  return {
    total: ok.length, unreadable, invalid,
    tallies: tally(payload, ok.map(b => b.answers), { includeComments: q => manager || !!q.settings.commentsPublic, quiz: false }),
    ...(manager && ok.some(b => b.voter) ? { voters: ok.map(b => ({ voter: b.voter ?? '', answers: b.answers })) } : {}),
  };
}
