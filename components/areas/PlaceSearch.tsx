'use client';

import { useEffect, useState } from 'react';
import { LEVEL_LABEL, type Area } from './myArea';

type Hit = Area & { name: string; country: string; chain: Area[] };

// Type a town, city, county or country and pick it. What's typed is sent in a
// request body (never a web address) and isn't logged. With `precision`, the
// member then chooses how precise to be: the place, its county, region or country.
export default function PlaceSearch({ onPick, precision = false, placeholder = 'Type a town, city, county or country…', autoFocus }: {
  onPick: (a: Area) => void; precision?: boolean; placeholder?: string; autoFocus?: boolean;
}) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [picked, setPicked] = useState<Hit | null>(null);
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    let live = true;
    const t = setTimeout(() => {
      fetch('/api/areas/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q }) })
        .then(r => r.ok ? r.json() : { areas: [] }).then(d => { if (live) setHits(d.areas ?? []); }).catch(() => {});
    }, 200);
    return () => { live = false; clearTimeout(t); };
  }, [q]);
  const field = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none';
  const choose = (h: Hit) => {
    if (precision && h.chain.length > 1) { setPicked(h); return; }
    onPick({ id: h.id, label: h.label, level: h.level, path: h.path }); setQ(''); setHits([]);
  };
  if (picked) return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">How precise? Less precise shows you more Societies, from a wider area.</p>
      <div className="flex flex-wrap gap-1.5">
        {[...picked.chain].reverse().map(c => (
          <button key={c.id} type="button" onClick={() => { onPick({ id: c.id, label: c.label, level: c.level, path: c.path }); setPicked(null); setQ(''); setHits([]); }}
            className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:border-blue-500/60">
            {c.label.split(', ')[0]} <span className="text-slate-500">({LEVEL_LABEL[c.level] ?? c.level})</span>
          </button>
        ))}
        <button type="button" onClick={() => setPicked(null)} className="px-2 text-xs text-slate-500 hover:text-slate-300">Back</button>
      </div>
    </div>
  );
  return (
    <div className="relative">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} aria-label="Find a place" autoFocus={autoFocus} className={field} />
      {hits.length > 0 && (
        <ul className="absolute left-0 right-0 z-40 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-xl">
          {hits.map(h => (
            <li key={h.id}>
              <button type="button" onClick={() => choose(h)} className="flex w-full items-baseline gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-800">
                <span className="flex-1 text-slate-200">{h.label}</span>
                <span className="text-[10px] text-slate-500">{LEVEL_LABEL[h.level] ?? h.level} · {h.country}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-[10px] text-slate-600">Place names from <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer" className="underline">GeoNames</a> (CC BY 4.0)</p>
    </div>
  );
}
