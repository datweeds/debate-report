'use client';

import type { PollResults } from '@/lib/polls/server';
import type { QuestionTally } from '@/lib/polls/tally';
import { optionsOf, type PollPayload } from '@/lib/polls/types';
import WordCloud from './WordCloud';

// Results of a poll: one block per question, then quiz scores and (named polls, moderators) who chose what.
export default function Results({ results, payload, big = false }: { results: PollResults; payload: PollPayload; big?: boolean }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">{results.total} {results.total === 1 ? 'ballot' : 'ballots'} counted</p>
      {results.tallies.map((t, i) => <QuestionResult key={t.questionId} t={t} n={i + 1} payload={payload} big={big} />)}
      {results.quiz && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
          <p className="text-sm font-medium text-slate-100">Quiz scores</p>
          <p className="mt-1 text-xs text-slate-400">Average {results.quiz.average} out of {results.quiz.outOf}</p>
          <div className="mt-2 space-y-1">
            {Array.from({ length: results.quiz.outOf + 1 }, (_, s) => results.quiz!.outOf - s).map(s => (
              <Bar key={s} label={`${s} / ${results.quiz!.outOf}`} count={results.quiz!.distribution[s] ?? 0} total={results.total} />
            ))}
          </div>
        </div>
      )}
      {results.voters && results.voters.length > 0 && <VoterTable results={results} payload={payload} />}
    </div>
  );
}

function Bar({ label, count, total, pct, note, highlight, big }: { label: React.ReactNode; count: number; total: number; pct?: number; note?: string; highlight?: boolean; big?: boolean }) {
  const p = pct ?? (total ? Math.round((count / total) * 1000) / 10 : 0);
  return (
    <div>
      <div className={`flex items-baseline justify-between gap-3 ${big ? 'text-lg' : 'text-sm'}`}>
        <span className={highlight ? 'font-semibold text-emerald-300' : 'text-slate-200'}>{label}</span>
        <span className="tabular-nums text-slate-400">{note ?? `${count} · ${p}%`}</span>
      </div>
      <div className={`mt-1 overflow-hidden rounded-full bg-slate-800 ${big ? 'h-4' : 'h-2'}`}>
        <div className={`h-full rounded-full ${highlight ? 'bg-emerald-500' : 'bg-blue-500'} transition-all duration-500`} style={{ width: `${Math.min(100, p)}%` }} />
      </div>
    </div>
  );
}

export function QuestionResult({ t, n, payload, big }: { t: QuestionTally; n?: number; payload: PollPayload; big?: boolean }) {
  const q = payload.questions.find(x => x.id === t.questionId);
  const correct = new Set(t.correct ?? []);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
      <p className={`${big ? 'text-2xl' : 'text-sm'} font-medium text-slate-100`}>{n ? <span className="text-slate-500">{n}. </span> : null}{t.questionText}</p>
      <p className="mt-0.5 text-xs text-slate-500">
        {t.responses} {t.responses === 1 ? 'answer' : 'answers'}
        {t.correctCount !== undefined && ` · ${t.correctCount} correct`}
      </p>
      {t.winner !== undefined && t.responses > 0 && (
        <p className="mt-1.5 text-xs text-emerald-300">{t.winner ? `${t.type === 'rcv' ? 'Winner after instant runoff' : 'Leading'}: ${t.winner}` : t.tied ? `Tied: ${t.tied.join(', ')}` : ''}</p>
      )}

      <div className={`mt-3 ${big ? 'space-y-4' : 'space-y-2'}`}>
        {(t.type === 'single_choice' || t.type === 'yes_no' || t.type === 'multi_choice') && t.options?.map(o => (
          <Bar key={o.id} big={big} label={<>{correct.has(o.id) && '✓ '}{o.text}</>} count={o.count} total={t.responses} pct={o.pct} highlight={correct.has(o.id)} />
        ))}
        {t.type === 'ranked' && t.options?.map((o, i) => (
          <Bar key={o.id} big={big} label={`${i + 1}. ${o.text}`} count={o.count} total={t.responses} pct={o.pct}
            note={o.avgRank !== undefined ? `average rank ${o.avgRank} · first choice ${o.count}` : 'not ranked'} />
        ))}
        {t.type === 'star' && t.options?.map(o => (
          <Bar key={o.id} big={big} label={o.text} count={o.count} total={t.responses} pct={o.pct} note={`${o.avgScore} ★`} />
        ))}
        {t.type === 'scale' && t.responses > 0 && (
          <>
            <p className={`${big ? 'text-3xl' : 'text-lg'} font-semibold text-slate-100`}>Average {t.average}
              <span className="ml-2 text-xs font-normal text-slate-500">range {t.min}–{t.max}</span></p>
            <div className="flex h-24 items-end gap-1">
              {Object.keys(t.distribution ?? {}).length > 0 && (() => {
                const min = q?.settings.scaleMin ?? 1, max = q?.settings.scaleMax ?? 10;
                const top = Math.max(...Object.values(t.distribution!));
                return Array.from({ length: max - min + 1 }, (_, i) => min + i).map(v => (
                  <div key={v} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-blue-500" style={{ height: `${((t.distribution![v] ?? 0) / top) * 72}px` }} title={`${t.distribution![v] ?? 0}`} />
                    <span className="text-[10px] text-slate-500">{v}</span>
                  </div>
                ));
              })()}
            </div>
          </>
        )}
        {t.type === 'word' && <WordCloud words={t.words ?? []} height={big ? 380 : 220} />}
        {t.type === 'rcv' && t.rounds && t.rounds.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr><th className="py-1 pr-3 font-normal">Option</th>{t.rounds.map(r => <th key={r.round} className="px-2 font-normal">Round {r.round}</th>)}</tr>
              </thead>
              <tbody className="text-slate-300">
                {(q ? optionsOf(q) : []).map(o => (
                  <tr key={o.id} className="border-t border-slate-800/60">
                    <td className="py-1.5 pr-3">{o.text}{t.winner === o.text && <span className="ml-1 text-emerald-300">✓</span>}</td>
                    {t.rounds!.map(r => (
                      <td key={r.round} className={`px-2 tabular-nums ${r.eliminated.includes(o.id) ? 'text-rose-300 line-through' : ''}`}>
                        {r.counts[o.id] ?? <span className="text-slate-700">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-slate-800/60 text-slate-500"><td className="py-1.5 pr-3">Exhausted</td>{t.rounds.map(r => <td key={r.round} className="px-2 tabular-nums">{r.exhausted}</td>)}</tr>
              </tbody>
            </table>
            <p className="mt-1 text-[11px] text-slate-500">Each round counts every ballot for its highest-ranked option still in the race; the lowest is eliminated until one has a majority.</p>
          </div>
        )}
      </div>

      {t.comments.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-slate-400 hover:text-slate-200">{t.comments.length} comment{t.comments.length > 1 ? 's' : ''}</summary>
          <ul className="mt-2 space-y-1.5 text-slate-300">{t.comments.map((c, i) => <li key={i} className="rounded bg-slate-900/60 px-2 py-1.5">“{c}”</li>)}</ul>
        </details>
      )}
    </div>
  );
}

function VoterTable({ results, payload }: { results: PollResults; payload: PollPayload }) {
  const show = (qid: string, v: unknown) => {
    const q = payload.questions.find(x => x.id === qid);
    const name = (id: string) => (q ? optionsOf(q).find(o => o.id === id)?.text : undefined) ?? id;
    if (v && typeof v === 'object' && !Array.isArray(v)) return Object.entries(v as Record<string, number>).map(([k, s]) => `${name(k)} ${s}★`).join(', ');
    if (Array.isArray(v)) return v.map(name).join(q?.type === 'multi_choice' ? ', ' : ' › ');
    return typeof v === 'string' && q?.type !== 'word' ? name(v) : String(v ?? '');
  };
  return (
    <details className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 text-xs">
      <summary className="cursor-pointer text-sm font-medium text-slate-100">Who chose what (named poll)</summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-slate-500"><tr><th className="py-1 pr-3 font-normal">Voter</th>{payload.questions.map((q, i) => <th key={q.id} className="pr-3 font-normal">Q{i + 1}</th>)}{results.voters![0]?.score !== undefined && <th className="font-normal">Score</th>}</tr></thead>
          <tbody className="text-slate-300">
            {results.voters!.map((v, i) => (
              <tr key={i} className="border-t border-slate-800/60 align-top">
                <td className="py-1.5 pr-3 whitespace-nowrap">{v.voter}</td>
                {payload.questions.map(q => <td key={q.id} className="pr-3">{show(q.id, v.answers.find(a => a.questionId === q.id)?.value)}</td>)}
                {v.score !== undefined && <td className="tabular-nums">{v.score}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
