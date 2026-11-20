'use client';

import { useEffect, useState } from 'react';

// A Society's web address (new.vote/society/<name>), checked as it's typed.
export default function WebAddressField({ value, onChange, exceptId, onValidity, note }: {
  value: string; onChange: (v: string) => void; exceptId?: number; onValidity?: (ok: boolean) => void; note?: React.ReactNode;
}) {
  const [state, setState] = useState<{ ok: boolean; error?: string } | null>(null);
  useEffect(() => {
    if (!value) { setState(null); onValidity?.(false); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/manage/societies/slug?value=${encodeURIComponent(value)}${exceptId ? `&except=${exceptId}` : ''}`);
      const d = r.ok ? await r.json() : { ok: false, error: 'Could not check the address' };
      setState(d); onValidity?.(!!d.ok);
    }, 300);
    return () => clearTimeout(t);
  }, [value, exceptId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">Web address</label>
      <div className="flex items-center overflow-hidden rounded-lg border border-slate-700 bg-slate-900 focus-within:border-blue-500">
        <span className="select-none whitespace-nowrap pl-3 text-sm text-slate-500">new.vote/society/</span>
        <input value={value} onChange={e => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40))}
          spellCheck={false} autoComplete="off" aria-label="Web address name"
          className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-slate-100 focus:outline-none" />
      </div>
      <p className={`mt-1 text-xs ${state?.ok ? 'text-emerald-400' : state?.error ? 'text-rose-300' : 'text-slate-500'}`}>
        {state?.ok ? '✓ Available' : state?.error ?? 'Lower-case letters, numbers and hyphens, e.g. edinburgh-climate.'}
      </p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
}
