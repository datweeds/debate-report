'use client';

import { useState } from 'react';
import { FEATURES } from '@/lib/features';

// Manage Society: switch each feature on or off. Switching off hides it and
// keeps its content; switching back on brings everything back.
export default function FeaturesCard({ societyId, initial }: { societyId: number; initial: string[] }) {
  const [off, setOff] = useState<string[]>(initial);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function toggle(key: string) {
    const next = off.includes(key) ? off.filter(k => k !== key) : [...off, key];
    if (next.length === FEATURES.length) { setError('Keep at least one feature on.'); return; }
    setOff(next); setError(''); setSaved(false);
    const r = await fetch(`/api/manage/societies/${societyId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ disabled_sections: next }) });
    if (!r.ok) { setOff(off); setError('Could not save.'); return; }
    setSaved(true);
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-dr-card p-5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-200">Features</h2>
        {saved && <span className="text-xs text-emerald-400">✓ Saved</span>}
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Keep your Society simple: switch off what you don’t use. It disappears from the menus for everyone; its content is kept and comes back if you switch it on again.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {FEATURES.map(f => {
          const on = !off.includes(f.key);
          return (
            <li key={f.key}>
              <button type="button" role="switch" aria-checked={on} onClick={() => toggle(f.key)}
                className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${on ? 'border-blue-500/40 bg-blue-500/5' : 'border-slate-800 hover:border-slate-600'}`}>
                <span className={`mt-0.5 flex h-5 w-9 flex-shrink-0 items-center rounded-full p-0.5 transition-colors ${on ? 'bg-blue-600' : 'bg-slate-700'}`}>
                  <span className={`h-4 w-4 rounded-full bg-white transition-transform ${on ? 'translate-x-4' : ''}`} />
                </span>
                <span>
                  <span className={`block text-sm font-medium ${on ? 'text-slate-100' : 'text-slate-400'}`}>{f.label}</span>
                  <span className="block text-xs text-slate-500">{f.blurb}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
