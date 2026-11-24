'use client';

import { useEffect, useState } from 'react';
import { AGE_BANDS, AGE_LABELS, UNDER_16, type AgeBand } from '@/lib/ageBands';

// Profile: your age group. You can correct it either way; changes are recorded,
// and may mean we ask you to confirm your age.
export default function AgeBandCard() {
  const [band, setBand] = useState<AgeBand | null | undefined>(undefined);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    fetch('/api/user/age-band').then(r => r.ok ? r.json() : { band: null })
      .then(d => { setBand(d.band ?? null); setChecked(!!d.checked); }).catch(() => setBand(null));
  }, []);
  async function choose(b: AgeBand | typeof UNDER_16) {
    if (b === band) return;
    if (b === UNDER_16) {
      if (!confirm('new.vote is for people aged 16 and over. If you are under 16, your account will be put on hold and the new.vote team will look at it. Continue?')) return;
    } else if (band && !confirm(`Change your age group to ${AGE_LABELS[b]}? Changes are recorded, and we may ask you to confirm your age.`)) return;
    setSaving(true); setError('');
    const r = await fetch('/api/user/age-band', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ band: b }) });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (d.held) { window.location.href = '/'; return; }
    if (d.checkNeeded) { window.location.href = '/age-check'; return; }
    if (r.ok) setBand(d.band); else setError(d.error ?? 'Couldn’t save');
  }
  if (band === undefined) return <div className="h-10 rounded bg-slate-800/40 animate-pulse" />;
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        {checked
          ? 'Your age has been checked, so your age group can only move to 16 or 17 from here.'
          : band
            ? 'Used only to keep younger members safe. If you chose the wrong one, you can change it. Changes are recorded, and we may ask you to confirm your age.'
            : 'Please tell us your age group. We use it only to keep younger members safe, and keep nothing more precise.'}
      </p>
      <div className="flex flex-wrap gap-2">
        {AGE_BANDS.map(b => (
          <button key={b} type="button" disabled={saving || (checked && b === '18+' && band !== '18+')} onClick={() => choose(b)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${b === band ? 'border-blue-500 bg-blue-500/15 text-blue-200' : 'border-slate-700 text-slate-300 hover:border-slate-500'} disabled:opacity-40`}>
            {AGE_LABELS[b]}
          </button>
        ))}
      </div>
      <button type="button" disabled={saving} onClick={() => choose(UNDER_16)} className="text-[11px] text-slate-500 underline underline-offset-2 hover:text-slate-300">
        I’m under 16
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
