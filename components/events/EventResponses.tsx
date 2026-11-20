'use client';

import { useState } from 'react';
import type { Responses } from '@/lib/events';

// "Planning to attend" / "Not coming" on an event, and what this person may
// see of everyone's responses. Members can change or clear their answer.
export default function EventResponses({ url, initial, onChanged }: { url: string; initial: Responses; onChanged: () => void }) {
  const [r, setR] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function answer(v: 'going' | 'not_going') {
    setBusy(true); setError('');
    const res = await fetch(url, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: r.mine === v ? null : v }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !d.responses) { setError(d.error ?? 'Couldn’t save your response'); return; }
    setR(d.responses); onChanged();
  }
  const btn = (v: 'going' | 'not_going', label: string, on: string) => (
    <button type="button" onClick={() => answer(v)} disabled={busy} aria-pressed={r.mine === v}
      title={r.mine === v ? 'Click again to clear your response' : undefined}
      className={`rounded-lg border px-3 py-1.5 text-sm disabled:opacity-60 ${r.mine === v ? on : 'border-slate-600 text-slate-300 hover:border-slate-400'}`}>
      {label}
    </button>
  );
  const names = (list: string[]) => list.map(h => '@' + h).join(', ');

  return (
    <div className="mt-4 space-y-2 rounded-xl border border-slate-700/60 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Responses</p>
      {r.canRespond ? (
        <div className="flex flex-wrap gap-2">
          {btn('going', '✓ Planning to attend', 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200')}
          {btn('not_going', '✗ Not coming', 'border-rose-500/60 bg-rose-500/15 text-rose-200')}
        </div>
      ) : r.over ? (
        <p className="text-xs text-slate-500">This event has finished{r.mine ? `: you said ${r.mine === 'going' ? 'you were planning to attend' : 'you weren’t coming'}` : ''}.</p>
      ) : null}
      {r.canRespond && r.mine && <p className="text-[11px] text-slate-500">You can change your response at any time, or click it again to clear it.</p>}

      {r.going != null ? (
        <p className="text-sm text-slate-300">
          <span className="font-semibold text-emerald-300">{r.going}</span> planning to attend · <span className="font-semibold text-rose-300">{r.notGoing}</span> not coming
        </p>
      ) : (
        <p className="text-xs text-slate-500">Only the event’s author and moderators can see the responses.</p>
      )}
      {r.names && (r.names.going.length > 0 || r.names.notGoing.length > 0) && (
        <div className="space-y-1 text-xs">
          {r.names.going.length > 0 && <p className="text-slate-300"><span className="text-emerald-300">Attending:</span> {names(r.names.going)}</p>}
          {r.names.notGoing.length > 0 && <p className="text-slate-300"><span className="text-rose-300">Not coming:</span> {names(r.names.notGoing)}</p>}
        </div>
      )}
      {r.names && r.visibility !== 'all' && (
        <p className="text-[11px] text-slate-500">
          {r.visibility === 'counts' ? 'Members see only the numbers. You see names as the event’s author or a moderator.' : 'Only the event’s author and moderators see these responses.'}
        </p>
      )}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
