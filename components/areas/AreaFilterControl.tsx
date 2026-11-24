'use client';

import { useState } from 'react';
import Link from 'next/link';
import PlaceSearch from './PlaceSearch';
import type { Area, AreaFilter } from './myArea';

// Area filter (adults only): any area, Societies for my area, or in another area.
// Choosing another area never changes My area.
export default function AreaFilterControl({ value, onChange, mine, compact, onNavigate }: {
  value: AreaFilter; onChange: (f: AreaFilter) => void; mine: Area | null; compact?: boolean; onNavigate?: () => void;
}) {
  const [choosing, setChoosing] = useState(false);
  const cls = compact
    ? 'w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-300 focus:border-blue-500 focus:outline-none'
    : 'w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 focus:border-blue-500 focus:outline-none';
  const v = value.mode === 'in' ? 'in' : value.mode;
  return (
    <div className="space-y-1.5">
      <select value={v} aria-label="Area" className={cls}
        onChange={e => {
          const m = e.target.value;
          if (m === 'any') { onChange({ mode: 'any' }); setChoosing(false); }
          else if (m === 'mine') { onChange({ mode: 'mine' }); setChoosing(false); }
          else setChoosing(true);
        }}>
        <option value="any">Any area</option>
        {mine && <option value="mine">For my area: {mine.label.split(', ')[0]}</option>}
        {value.mode === 'in' && <option value="in">In {value.area.label.split(', ')[0]}</option>}
        <option value="choose">{value.mode === 'in' ? 'Choose another area…' : 'In an area…'}</option>
      </select>
      {choosing && <PlaceSearch autoFocus onPick={a => { onChange({ mode: 'in', area: a }); setChoosing(false); }} />}
      {!mine && !choosing && (
        <p className={`${compact ? 'text-[10px]' : 'text-xs'} text-slate-500`}>
          <Link href="/profile#my-area" onClick={onNavigate} className="text-blue-400 hover:text-blue-300">Set your area</Link> to find local Societies.
        </p>
      )}
    </div>
  );
}
