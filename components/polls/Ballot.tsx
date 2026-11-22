'use client';

import { useMemo, useState } from 'react';
import { optionsOf, type Answer, type PollOption, type PollPayload, type Question } from '@/lib/polls/types';
import { btnGhost, btnPrimary, inputCls, seededShuffle } from './shared';

type Value = Answer['value'] | undefined;

// The voting form: every open question, a review step, then cast.
export default function Ballot({ payload, open, initial, seed, busy, error, onCast, castLabel = 'Cast vote' }: {
  payload: PollPayload; open: number; initial: Answer[] | null; seed: string;
  busy: boolean; error: string; onCast: (answers: Answer[]) => void; castLabel?: string;
}) {
  const questions = payload.questions.slice(0, open);
  const [values, setValues] = useState<Record<string, Value>>(() => Object.fromEntries((initial ?? []).map(a => [a.questionId, a.value])));
  const [comments, setComments] = useState<Record<string, string>>(() => Object.fromEntries((initial ?? []).filter(a => a.comment).map(a => [a.questionId, a.comment!])));
  const [review, setReview] = useState(false);
  const missing = questions.filter(q => !answered(q, values[q.id]));
  const answers: Answer[] = questions.map(q => ({ questionId: q.id, value: values[q.id]!, ...(comments[q.id]?.trim() ? { comment: comments[q.id].trim() } : {}) }));

  if (review) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-semibold text-slate-200">Check your answers</p>
        <ol className="space-y-3">
          {questions.map((q, i) => (
            <li key={q.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-sm">
              <p className="text-slate-400">{i + 1}. {q.text}</p>
              <p className="mt-1 font-medium text-slate-100">{describe(q, values[q.id])}</p>
              {comments[q.id]?.trim() && <p className="mt-1 text-xs italic text-slate-400">“{comments[q.id].trim()}”</p>}
            </li>
          ))}
        </ol>
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <div className="flex gap-2">
          <button className={btnGhost} onClick={() => setReview(false)} disabled={busy}>Change answers</button>
          <button className={btnPrimary} onClick={() => onCast(answers)} disabled={busy}>{busy ? 'Sending…' : castLabel}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {questions.map((q, i) => (
        <fieldset key={q.id} className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
          <legend className="sr-only">{q.text}</legend>
          <p className="mb-3 text-sm font-medium text-slate-100"><span className="text-slate-500">{i + 1}.</span> {q.text}</p>
          <QuestionInput q={q} seed={seed} value={values[q.id]} onChange={v => setValues(s => ({ ...s, [q.id]: v }))} />
          {q.settings.allowComments && (
            <textarea value={comments[q.id] ?? ''} onChange={e => setComments(s => ({ ...s, [q.id]: e.target.value }))} rows={2} maxLength={1000}
              placeholder={q.settings.commentsPublic ? 'Comment (optional, shown with the results)' : 'Comment (optional, seen by the Society Admins)'}
              className={`${inputCls} mt-3 text-xs`} />
          )}
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button className={btnPrimary} disabled={missing.length > 0} onClick={() => setReview(true)}>Review and vote</button>
        {missing.length > 0 && <span className="text-xs text-slate-500">{missing.length} question{missing.length > 1 ? 's' : ''} still to answer</span>}
      </div>
    </div>
  );
}

function answered(q: Question, v: Value): boolean {
  if (v == null) return false;
  switch (q.type) {
    case 'multi_choice': case 'rcv': return Array.isArray(v) && v.length > 0;
    case 'ranked': return Array.isArray(v) && v.length === q.options.length;
    case 'star': return typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === q.options.length;
    case 'word': return typeof v === 'string' && !!v.trim();
    default: return true;
  }
}

function describe(q: Question, v: Value): string {
  const name = (id: string) => optionsOf(q).find(o => o.id === id)?.text ?? id;
  if (v == null) return '—';
  if (q.type === 'star') return Object.entries(v as Record<string, number>).map(([k, s]) => `${name(k)}: ${'★'.repeat(s)}`).join(' · ');
  if (Array.isArray(v)) return q.type === 'multi_choice' ? v.map(name).join(', ') : v.map((id, i) => `${i + 1}. ${name(id)}`).join('  ');
  return typeof v === 'string' && q.type !== 'word' ? name(v) : String(v);
}

function OptionLabel({ o }: { o: PollOption }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      {o.image && <img src={o.image} alt="" className="h-12 w-12 flex-shrink-0 rounded-md object-cover" />}
      <span className="min-w-0">
        <span className="text-sm text-slate-200">{o.text}</span>
        {o.moreInfoLink && <a href={o.moreInfoLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="ml-2 text-xs text-blue-400 hover:underline">More info ↗</a>}
      </span>
    </span>
  );
}

const choice = (on: boolean) =>
  `flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${on ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-slate-500'}`;

function QuestionInput({ q, seed, value, onChange }: { q: Question; seed: string; value: Value; onChange: (v: Value) => void }) {
  const opts = useMemo(() => q.settings.randomOrder ? seededShuffle(optionsOf(q), `${seed}:${q.id}`) : optionsOf(q), [q, seed]);

  if (q.type === 'single_choice' || q.type === 'yes_no') {
    return (
      <div className={q.type === 'yes_no' ? 'flex gap-2' : 'space-y-2'} role="radiogroup">
        {opts.map(o => (
          <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)} className={choice(value === o.id)}>
            <span className={`h-4 w-4 flex-shrink-0 rounded-full border-2 ${value === o.id ? 'border-blue-400 bg-blue-500' : 'border-slate-500'}`} />
            <OptionLabel o={o} />
          </button>
        ))}
      </div>
    );
  }

  if (q.type === 'multi_choice') {
    const sel = (value as string[] | undefined) ?? [];
    const max = q.settings.maxChoices || 0;
    return (
      <div className="space-y-2">
        {max > 0 && <p className="text-xs text-slate-500">Choose up to {max}.</p>}
        {opts.map(o => {
          const on = sel.includes(o.id);
          return (
            <button key={o.id} type="button" role="checkbox" aria-checked={on} className={choice(on)}
              onClick={() => onChange(on ? sel.filter(x => x !== o.id) : max && sel.length >= max ? sel : [...sel, o.id])}>
              <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 text-[10px] text-white ${on ? 'border-blue-400 bg-blue-500' : 'border-slate-500'}`}>{on && '✓'}</span>
              <OptionLabel o={o} />
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === 'ranked' || q.type === 'rcv') {
    const order = (value as string[] | undefined) ?? [];
    const unranked = opts.filter(o => !order.includes(o.id));
    const byId = (id: string) => opts.find(o => o.id === id)!;
    const move = (i: number, d: number) => { const n = [...order]; [n[i], n[i + d]] = [n[i + d], n[i]]; onChange(n); };
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          {q.type === 'rcv'
            ? 'Click options in order of preference. Rank as many as you like: if your first choice is knocked out, your vote moves to your next.'
            : 'Click options in order of preference, from most to least preferred, until all are ranked.'}
        </p>
        {order.length > 0 && (
          <ol className="space-y-1.5">
            {order.map((id, i) => (
              <li key={id} className="flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/5 px-3 py-2">
                <span className="w-5 text-sm font-bold text-blue-300">{i + 1}</span>
                <span className="min-w-0 flex-1"><OptionLabel o={byId(id)} /></span>
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="px-1 text-slate-400 hover:text-white disabled:opacity-30">↑</button>
                <button type="button" aria-label="Move down" disabled={i === order.length - 1} onClick={() => move(i, 1)} className="px-1 text-slate-400 hover:text-white disabled:opacity-30">↓</button>
                <button type="button" aria-label="Remove" onClick={() => onChange(order.filter(x => x !== id))} className="px-1 text-slate-500 hover:text-rose-300">✕</button>
              </li>
            ))}
          </ol>
        )}
        {unranked.length > 0 && (
          <div className="space-y-1.5">
            {unranked.map(o => (
              <button key={o.id} type="button" onClick={() => onChange([...order, o.id])} className={choice(false)}>
                <span className="w-5 text-sm text-slate-600">+</span><OptionLabel o={o} />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (q.type === 'star') {
    const s = (value as Record<string, number> | undefined) ?? {};
    return (
      <div className="space-y-2">
        {opts.map(o => (
          <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 px-3 py-2">
            <OptionLabel o={o} />
            <span className="flex" role="radiogroup" aria-label={`Rate ${o.text}`}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" role="radio" aria-checked={s[o.id] === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  onClick={() => onChange({ ...s, [o.id]: n })}
                  className={`px-0.5 text-xl leading-none ${(s[o.id] ?? 0) >= n ? 'text-amber-400' : 'text-slate-600 hover:text-amber-300'}`}>★</button>
              ))}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (q.type === 'scale') {
    const min = q.settings.scaleMin ?? 1, max = q.settings.scaleMax ?? 10;
    const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    return (
      <div>
        <div className="flex flex-wrap gap-1.5">
          {steps.map(n => (
            <button key={n} type="button" onClick={() => onChange(n)} aria-pressed={value === n}
              className={`h-9 min-w-9 rounded-lg border px-2 text-sm font-medium ${value === n ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}>{n}</button>
          ))}
        </div>
        {(q.settings.scaleMinLabel || q.settings.scaleMaxLabel) && (
          <div className="mt-1.5 flex justify-between text-xs text-slate-500"><span>{q.settings.scaleMinLabel}</span><span>{q.settings.scaleMaxLabel}</span></div>
        )}
      </div>
    );
  }

  // word
  return (
    <input value={(value as string | undefined) ?? ''} onChange={e => onChange(e.target.value.replace(/\s+/g, ' ').slice(0, 40))}
      placeholder="One word or a short phrase" maxLength={40} className={inputCls} />
  );
}
