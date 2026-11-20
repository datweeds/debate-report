'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PollResults } from '@/lib/polls/server';
import type { PollPayload } from '@/lib/polls/types';
import { QuestionResult } from './Results';
import { countSealed, openPayload, useSealedPoll } from './sealedPoll';

type Live = { status: string; vote_count: number; open_questions: number; results: PollResults | null };

// Full-screen live results for a meeting: one question at a time, refreshing every few seconds.
export default function PollPresent({ societyId, pollId }: { societyId: number; pollId: string }) {
  const base = `/api/societies/${societyId}/polls/${pollId}`;
  const [payload, setPayload] = useState<PollPayload | null>(null);
  const [manager, setManager] = useState(false);
  const [sequential, setSequential] = useState(false);
  const [live, setLive] = useState<Live | null>(null);
  const [index, setIndex] = useState<number | null>(null);   // null: a live poll follows its latest open question; otherwise the first
  // A sealed poll: its questions and ballots are opened, and counted, here
  const [sealedPayload, setSealedPayload] = useState<string | null>(null);
  const [rawLive, setRawLive] = useState<Live | null>(null);
  const sp = useSealedPoll(societyId, pollId, !!sealedPayload);

  useEffect(() => {
    fetch(base).then(async r => {
      if (!r.ok) return;
      const d = await r.json();
      if (d.poll.protection === 'sealed') setSealedPayload(d.poll.sealed_payload); else setPayload(d.poll.payload);
      setManager(d.manager); setSequential(d.poll.question_order === 'sequential');
    });
  }, [base]);
  useEffect(() => { if (sealedPayload && sp.keys) setPayload(openPayload(sp.keys, sealedPayload)); }, [sealedPayload, sp.keys]);
  useEffect(() => {
    if (!rawLive) return;
    setLive(rawLive.results?.sealedBallots && payload
      ? { ...rawLive, results: countSealed(sp.keys, payload, rawLive.results.sealedBallots, manager) } : rawLive);
  }, [rawLive, payload, sp.keys, manager]);
  const poll = useCallback(async () => {
    const r = await fetch(`${base}/results`, { cache: 'no-store' });
    if (r.ok) setRawLive(await r.json());
  }, [base]);
  useEffect(() => { void poll(); const t = setInterval(poll, 3000); return () => clearInterval(t); }, [poll]);

  if (!payload || !live) return <div className="flex min-h-[60vh] items-center justify-center text-slate-500">Loading…</div>;
  const shown = index ?? (sequential ? Math.max(0, live.open_questions - 1) : 0);
  const q = payload.questions[shown];
  const t = live.results?.tallies.find(x => x.questionId === q?.id);

  async function reveal() {
    await fetch(base, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reveal' }) });
    setIndex(null); void poll();
  }

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-dr-base p-6 sm:p-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-lg font-semibold text-slate-300">{payload.title}</p>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span className="tabular-nums"><span className="text-3xl font-bold text-slate-100">{live.vote_count}</span> voted</span>
            <span className="rounded-full border border-slate-700 px-2.5 py-0.5 text-xs uppercase tracking-wider">{live.status}</span>
            <a href={`/society/${societyId}/polls/${pollId}`} className="text-xs text-blue-400 hover:underline">Exit</a>
          </div>
        </div>
        {q && t ? <QuestionResult t={t} n={shown + 1} payload={payload} big /> : (
          <div className="rounded-xl border border-slate-800 p-10 text-center text-slate-500">{live.results ? 'No question open yet.' : 'Results are not shown for this poll.'}</div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex gap-2">
            <button disabled={shown === 0} onClick={() => setIndex(shown - 1)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 disabled:opacity-30">← Previous</button>
            <button disabled={shown >= live.open_questions - 1} onClick={() => setIndex(sequential && shown + 1 >= live.open_questions - 1 ? null : shown + 1)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 disabled:opacity-30">Next →</button>
          </div>
          <span className="text-slate-500">Question {shown + 1} of {payload.questions.length}</span>
          {manager && live.status === 'open' && live.open_questions < payload.questions.length && (
            <button onClick={reveal} className="rounded-lg bg-blue-600 px-4 py-1.5 font-semibold text-white hover:bg-blue-500">Open question {live.open_questions + 1}</button>
          )}
        </div>
      </div>
    </div>
  );
}
