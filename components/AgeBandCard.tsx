'use client';

import { useEffect, useState } from 'react';
import { AGE_BANDS, AGE_LABELS, mayChangeBand, type AgeBand } from '@/lib/ageBands';

// Profile: your age group. You can move up as you get older, never down.
export default function AgeBandCard() {
  const [band, setBand] = useState<AgeBand | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    fetch('/api/user/age-band').then(r => r.ok ? r.json() : { band: null }).then(d => setBand(d.band ?? null)).catch(() => setBand(null));
  }, []);
  async function choose(b: AgeBand) {
    if (b === band) return;
    if (band && !confirm(`Change your age group to ${AGE_LABELS[b]}? You can’t move back down.`)) return;
    setSaving(true); setError('');
    const r = await fetch('/api/user/age-band', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ band: b }) });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (r.ok) setBand(d.band); else setError(d.error ?? 'Couldn’t save');
  }
  if (band === undefined) return <div className="h-10 rounded bg-slate-800/40 animate-pulse" />;
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        {band
          ? 'Used only to keep younger members safe. You can move up an age group as you get older, but not down.'
          : 'Please tell us your age group. We use it only to keep younger members safe, and keep nothing more precise.'}
      </p>
      <div className="flex flex-wrap gap-2">
        {AGE_BANDS.map(b => {
          const allowed = mayChangeBand(band, b);
          return (
            <button key={b} type="button" disabled={saving || !allowed} onClick={() => choose(b)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${b === band ? 'border-blue-500 bg-blue-500/15 text-blue-200' : 'border-slate-700 text-slate-300 hover:border-slate-500'} disabled:opacity-40`}>
              {AGE_LABELS[b]}
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
