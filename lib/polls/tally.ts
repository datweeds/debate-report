// Counting poll ballots, and checking a ballot is well-formed. Pure functions
// (no database), so the accuracy tests exercise exactly what the app runs.

import { optionsOf, type Answer, type PollPayload, type Question } from './types';

export type OptionTally = { id: string; text: string; image?: string; count: number; pct: number; avgRank?: number; avgScore?: number };
export type RcvRound = { round: number; counts: Record<string, number>; exhausted: number; eliminated: string[] };
export type QuestionTally = {
  questionId: string;
  questionText: string;
  type: Question['type'];
  responses: number;
  options?: OptionTally[];
  average?: number; min?: number; max?: number;
  distribution?: Record<string, number>;   // scale: value → count
  words?: { word: string; count: number }[];
  comments: string[];
  winner?: string | null;                  // option text; null when tied
  tied?: string[];
  rounds?: RcvRound[];                     // rcv: each instant-runoff round
  correct?: string[];                      // quiz
  correctCount?: number;                   // quiz: ballots that got it right
};

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
const round1 = (x: number) => Math.round(x * 10) / 10;

/** Whether an answer to a quiz question is right. */
export function isCorrect(q: Question, a: Answer | undefined): boolean {
  if (!a || !q.correct?.length) return false;
  const want = [...q.correct].sort();
  if (Array.isArray(a.value)) {
    // ranked: the first choice must be (one of) the correct answer(s); multi: exactly the correct set
    if (q.type === 'ranked' || q.type === 'rcv') return want.includes(a.value[0]);
    const got = [...a.value].sort();
    return got.length === want.length && got.every((v, i) => v === want[i]);
  }
  return typeof a.value === 'string' && want.includes(a.value);
}

/** The winner(s) of the highest count: one name, or null with the tied names. */
function leader(opts: OptionTally[], key: (o: OptionTally) => number, lowIsBest = false) {
  const usable = opts.filter(o => key(o) > 0 || lowIsBest);
  if (!usable.length) return { winner: null as string | null, tied: undefined as string[] | undefined };
  const best = lowIsBest ? Math.min(...usable.map(key)) : Math.max(...usable.map(key));
  const top = usable.filter(o => key(o) === best);
  return top.length === 1 ? { winner: top[0].text, tied: undefined } : { winner: null, tied: top.map(o => o.text) };
}

/**
 * Instant runoff: count each ballot for its highest-ranked continuing option;
 * if none has a majority of continuing ballots, eliminate the lowest (ties:
 * all lowest together, unless that would eliminate everyone) and repeat.
 */
export function instantRunoff(optionIds: string[], rankings: string[][]): { rounds: RcvRound[]; winner: string | null; tied?: string[] } {
  const rounds: RcvRound[] = [];
  let continuing = new Set(optionIds);
  for (let round = 1; round <= optionIds.length + 1; round++) {
    const counts: Record<string, number> = Object.fromEntries([...continuing].map(id => [id, 0]));
    let exhausted = 0;
    for (const r of rankings) {
      const pick = r.find(id => continuing.has(id));
      if (pick) counts[pick]++; else exhausted++;
    }
    const active = Object.values(counts).reduce((a, b) => a + b, 0);
    const entries = Object.entries(counts);
    const max = Math.max(0, ...entries.map(([, n]) => n));
    if (active === 0) { rounds.push({ round, counts, exhausted, eliminated: [] }); return { rounds, winner: null }; }
    if (max * 2 > active || continuing.size === 1) {
      rounds.push({ round, counts, exhausted, eliminated: [] });
      return { rounds, winner: entries.find(([, n]) => n === max)![0] };
    }
    const min = Math.min(...entries.map(([, n]) => n));
    const lowest = entries.filter(([, n]) => n === min).map(([id]) => id);
    if (lowest.length === continuing.size) {
      // Everyone left is tied
      rounds.push({ round, counts, exhausted, eliminated: [] });
      return { rounds, winner: null, tied: lowest };
    }
    rounds.push({ round, counts, exhausted, eliminated: lowest });
    continuing = new Set([...continuing].filter(id => !lowest.includes(id)));
  }
  return { rounds, winner: null };
}

/** Tally every question over the counted ballots. */
export function tally(payload: PollPayload, ballots: Answer[][], opts: { includeComments?: (q: Question) => boolean; quiz?: boolean } = {}): QuestionTally[] {
  return payload.questions.map(q => {
    const answers = ballots.map(b => b.find(a => a.questionId === q.id)).filter((a): a is Answer => !!a);
    const n = answers.length;
    const comments = opts.includeComments?.(q) ? answers.map(a => a.comment?.trim()).filter((c): c is string => !!c) : [];
    const base = { questionId: q.id, questionText: q.text, type: q.type, responses: n, comments,
      ...(opts.quiz && q.correct?.length ? { correct: q.correct, correctCount: answers.filter(a => isCorrect(q, a)).length } : {}) };
    const options = optionsOf(q);

    if (q.type === 'single_choice' || q.type === 'yes_no' || q.type === 'multi_choice') {
      const counts: Record<string, number> = {};
      for (const a of answers) for (const id of (Array.isArray(a.value) ? a.value : [a.value as string])) counts[id] = (counts[id] ?? 0) + 1;
      const opts2 = options.map(o => ({ id: o.id, text: o.text, image: o.image, count: counts[o.id] ?? 0, pct: pct(counts[o.id] ?? 0, n) }))
        .sort((a, b) => b.count - a.count);
      return { ...base, options: opts2, ...leader(opts2, o => o.count) };
    }

    if (q.type === 'ranked' || q.type === 'rcv') {
      const first: Record<string, number> = {}, sum: Record<string, number> = {}, cnt: Record<string, number> = {};
      for (const a of answers) {
        const order = a.value as string[];
        if (order[0]) first[order[0]] = (first[order[0]] ?? 0) + 1;
        order.forEach((id, i) => { sum[id] = (sum[id] ?? 0) + i + 1; cnt[id] = (cnt[id] ?? 0) + 1; });
      }
      const opts2 = options.map(o => ({ id: o.id, text: o.text, image: o.image, count: first[o.id] ?? 0, pct: pct(first[o.id] ?? 0, n),
        avgRank: cnt[o.id] ? round1(sum[o.id] / cnt[o.id]) : undefined }));
      if (q.type === 'rcv') {
        const irv = instantRunoff(options.map(o => o.id), answers.map(a => a.value as string[]));
        const name = (id: string) => options.find(o => o.id === id)?.text ?? id;
        opts2.sort((a, b) => b.count - a.count);
        return { ...base, options: opts2, rounds: irv.rounds, winner: irv.winner ? name(irv.winner) : null, tied: irv.tied?.map(name) };
      }
      opts2.sort((a, b) => (a.avgRank ?? 1e9) - (b.avgRank ?? 1e9));
      return { ...base, options: opts2, ...(n ? leader(opts2.filter(o => o.avgRank !== undefined), o => o.avgRank!, true) : { winner: null }) };
    }

    if (q.type === 'star') {
      const scores: Record<string, number[]> = {};
      for (const a of answers) for (const [id, s] of Object.entries(a.value as Record<string, number>)) (scores[id] ??= []).push(s);
      const opts2 = options.map(o => {
        const s = scores[o.id] ?? [];
        const avg = s.length ? round1(s.reduce((x, y) => x + y, 0) / s.length) : 0;
        return { id: o.id, text: o.text, image: o.image, count: s.length, pct: pct(avg, 5), avgScore: avg };
      }).sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));
      return { ...base, options: opts2, ...leader(opts2, o => o.avgScore ?? 0) };
    }

    if (q.type === 'scale') {
      const vals = answers.map(a => a.value as number);
      const distribution: Record<string, number> = {};
      for (const v of vals) distribution[v] = (distribution[v] ?? 0) + 1;
      return { ...base, distribution,
        average: vals.length ? round1(vals.reduce((x, y) => x + y, 0) / vals.length) : undefined,
        min: vals.length ? Math.min(...vals) : undefined, max: vals.length ? Math.max(...vals) : undefined };
    }

    // word
    const counts: Record<string, number> = {};
    for (const a of answers) { const w = String(a.value).toLowerCase().trim(); if (w) counts[w] = (counts[w] ?? 0) + 1; }
    const words = Object.entries(counts).map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
    return { ...base, words };
  });
}

/** Quiz score of one ballot: questions answered correctly, out of those with a correct answer. */
export function quizScore(payload: PollPayload, ballot: Answer[]) {
  const marked = payload.questions.filter(q => q.correct?.length);
  return { score: marked.filter(q => isCorrect(q, ballot.find(a => a.questionId === q.id))).length, outOf: marked.length };
}

/**
 * Check a ballot against the poll: every open question answered exactly once,
 * with a valid value for its type. Returns the cleaned ballot or an error.
 */
export function validateBallot(payload: PollPayload, open: number, raw: unknown): { ok: true; ballot: Answer[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: 'Answers are missing' };
  const questions = payload.questions.slice(0, open);
  const out: Answer[] = [];
  for (const q of questions) {
    const a = raw.find((x: Answer) => x?.questionId === q.id) as Answer | undefined;
    const label = `“${q.text.slice(0, 60)}”`;
    if (!a) return { ok: false, error: `Answer ${label}` };
    const ids = new Set(optionsOf(q).map(o => o.id));
    const v = a.value;
    let value: Answer['value'];
    switch (q.type) {
      case 'single_choice': case 'yes_no':
        if (typeof v !== 'string' || !ids.has(v)) return { ok: false, error: `Choose an option for ${label}` };
        value = v; break;
      case 'multi_choice': {
        if (!Array.isArray(v) || !v.length || v.some(x => typeof x !== 'string' || !ids.has(x)) || new Set(v).size !== v.length) return { ok: false, error: `Choose options for ${label}` };
        if (q.settings.maxChoices && v.length > q.settings.maxChoices) return { ok: false, error: `Choose at most ${q.settings.maxChoices} for ${label}` };
        value = v; break;
      }
      case 'ranked': case 'rcv': {
        // A full ranking for "ranked"; for instant runoff, at least a first choice (rank as many as you like)
        if (!Array.isArray(v) || v.some(x => typeof x !== 'string' || !ids.has(x)) || new Set(v).size !== v.length) return { ok: false, error: `Rank the options for ${label}` };
        if (q.type === 'ranked' ? v.length !== ids.size : v.length < 1) return { ok: false, error: `Rank ${q.type === 'ranked' ? 'every option' : 'at least one option'} for ${label}` };
        value = v; break;
      }
      case 'star': {
        if (!v || typeof v !== 'object' || Array.isArray(v)) return { ok: false, error: `Rate the options for ${label}` };
        const e = Object.entries(v as Record<string, unknown>);
        if (e.length !== ids.size || e.some(([id, s]) => !ids.has(id) || !Number.isInteger(s) || (s as number) < 1 || (s as number) > 5)) return { ok: false, error: `Rate every option 1–5 for ${label}` };
        value = v as Record<string, number>; break;
      }
      case 'scale': {
        const min = q.settings.scaleMin ?? 1, max = q.settings.scaleMax ?? 10;
        if (!Number.isInteger(v) || (v as number) < min || (v as number) > max) return { ok: false, error: `Pick ${min}–${max} for ${label}` };
        value = v as number; break;
      }
      case 'word': {
        const w = typeof v === 'string' ? v.trim() : '';
        if (!w || w.length > 40) return { ok: false, error: `Enter a word (up to 40 letters) for ${label}` };
        value = w; break;
      }
    }
    const comment = q.settings.allowComments && typeof a.comment === 'string' && a.comment.trim() ? a.comment.trim().slice(0, 1000) : undefined;
    out.push({ questionId: q.id, value, ...(comment ? { comment } : {}) });
  }
  return { ok: true, ballot: out };
}

/** Check a poll's questions are complete before it opens. */
export function validatePayload(raw: unknown): { ok: true; payload: PollPayload } | { ok: false; error: string } {
  const p = raw as PollPayload;
  if (!p || typeof p.title !== 'string' || !p.title.trim()) return { ok: false, error: 'Give the poll a title' };
  if (!Array.isArray(p.questions) || !p.questions.length) return { ok: false, error: 'Add at least one question' };
  if (p.questions.length > 50) return { ok: false, error: 'At most 50 questions' };
  const qids = new Set<string>();
  for (const [i, q] of p.questions.entries()) {
    if (!q?.id || qids.has(q.id)) return { ok: false, error: `Question ${i + 1} has no id` };
    qids.add(q.id);
    if (!q.text?.trim()) return { ok: false, error: `Question ${i + 1} needs its text` };
    if (['single_choice', 'multi_choice', 'ranked', 'rcv', 'star'].includes(q.type)) {
      const opts = q.options ?? [];
      if (opts.length < 2) return { ok: false, error: `Question ${i + 1} needs at least two options` };
      if (opts.some(o => !o.id || !o.text?.trim()) || new Set(opts.map(o => o.id)).size !== opts.length) return { ok: false, error: `Question ${i + 1}: every option needs text` };
    } else if (!['yes_no', 'scale', 'word'].includes(q.type)) return { ok: false, error: `Question ${i + 1}: unknown type` };
    if (q.type === 'scale') {
      const min = q.settings?.scaleMin ?? 1, max = q.settings?.scaleMax ?? 10;
      if (!Number.isInteger(min) || !Number.isInteger(max) || max <= min || max - min > 100) return { ok: false, error: `Question ${i + 1}: the scale needs a sensible range` };
    }
  }
  return { ok: true, payload: p };
}
