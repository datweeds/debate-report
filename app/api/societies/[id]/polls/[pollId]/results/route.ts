import { NextRequest, NextResponse } from 'next/server';
import { countedBallots, openQuestions, results, resultsVisible } from '@/lib/polls/server';
import { pollContext } from '@/lib/polls/access';
import { quizScore } from '@/lib/polls/tally';
import { optionsOf, type Answer } from '@/lib/polls/types';

type Params = { params: Promise<{ id: string; pollId: string }> };

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// GET — results, if this viewer may see them (polled by the live view).
// ?format=csv — moderators: one row per counted ballot.
export async function GET(req: NextRequest, { params }: Params) {
  const { id, pollId } = await params;
  const c = await pollContext(req, id, pollId);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { poll, manager } = c;

  if (req.nextUrl.searchParams.get('format') === 'csv') {
    if (!manager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (poll.sealed_payload) return NextResponse.json({ error: 'A sealed poll’s spreadsheet is made in your browser', sealed: true }, { status: 409 });
    const { ballots } = await countedBallots(poll);
    const qs = poll.payload.questions;
    const name = (q: (typeof qs)[number], id: string) => optionsOf(q).find(o => o.id === id)?.text ?? id;
    const show = (q: (typeof qs)[number], a?: Answer) => {
      if (!a) return '';
      if (q.type === 'star') return Object.entries(a.value as Record<string, number>).map(([k, v]) => `${name(q, k)}: ${v}`).join('; ');
      if (Array.isArray(a.value)) return a.value.map(v => name(q, v)).join(q.type === 'multi_choice' ? '; ' : ' > ');
      return typeof a.value === 'string' ? name(q, a.value) : String(a.value);
    };
    const head = [poll.ballot_mode === 'named' ? 'Voter' : 'Ballot', ...qs.flatMap(q => q.settings.allowComments ? [q.text, `${q.text} (comment)`] : [q.text]),
      ...(poll.is_quiz ? ['Score'] : [])];
    // Secret ballots are shuffled so their order says nothing about who voted when
    const rows = (poll.ballot_mode === 'named' ? ballots : [...ballots].sort(() => Math.random() - 0.5)).map((b, i) => [
      b.voter ?? `#${i + 1}`,
      ...qs.flatMap(q => { const a = b.answers.find(x => x.questionId === q.id); return q.settings.allowComments ? [show(q, a), a?.comment ?? ''] : [show(q, a)]; }),
      ...(poll.is_quiz ? [quizScore(poll.payload, b.answers).score] : []),
    ]);
    const csv = [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
    const file = (poll.payload.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'poll') + '.csv';
    return new NextResponse('﻿' + csv, { headers: {
      'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${file}"`, 'Cache-Control': 'private, no-store' } });
  }

  return NextResponse.json({
    status: poll.status, vote_count: poll.vote_count, open_questions: openQuestions(poll), questions_revealed: poll.questions_revealed,
    results: resultsVisible(poll, manager) ? await results(poll, manager) : null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
