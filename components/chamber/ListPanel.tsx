'use client';

import { useState } from 'react';
import { STAT_BADGE, STAT_LABEL } from './constants';
import type { FullStatement, Resolution } from './types';

type Props = {
  resolution: Resolution;
  statements: FullStatement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function ListPanel({ resolution, statements, selectedId, onSelect }: Props) {
  const [filter, setFilter] = useState('');

  const allItems = [
    {
      id: resolution.id, stat_type: 'resolution', stat_title: resolution.stat_title,
      stat_direction: null as string | null, retracted_at: null as string | null,
    },
    ...statements.map(s => ({
      id: s.id, stat_type: s.stat_type, stat_title: s.stat_title,
      stat_direction: s.stat_direction, retracted_at: s.retracted_at,
    })),
  ];

  const filtered = filter
    ? allItems.filter(s => s.stat_title.toLowerCase().includes(filter.toLowerCase()))
    : allItems;

  return (
    <div className="w-72 flex-shrink-0 flex flex-col border-r border-slate-800 bg-[#080d1a] overflow-hidden">

      <div className="px-3 py-2.5 border-b border-slate-800">
        <input
          type="text"
          placeholder="Filter statements…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="w-full rounded-lg border border-slate-800 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-blue-500/50 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-[1fr_auto_auto] gap-1 px-3 py-2 border-b border-slate-800">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Statement</span>
        <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Type</span>
        <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Dir</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map(s => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`w-full text-left grid grid-cols-[1fr_auto_auto] gap-2 items-center px-3 py-2.5 border-b border-slate-800/60 transition-colors ${
              s.id === selectedId
                ? 'bg-blue-500/10 border-l-2 border-l-blue-500'
                : 'hover:bg-slate-800/40'
            }`}
          >
            <span className={`text-sm truncate leading-snug min-w-0 ${s.retracted_at ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
              {s.stat_title}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold border flex-shrink-0 ${STAT_BADGE[s.stat_type] ?? STAT_BADGE.claim}`}>
              {STAT_LABEL[s.stat_type]?.slice(0, 4) ?? s.stat_type.slice(0, 4)}
            </span>
            {s.stat_direction ? (
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold border flex-shrink-0 ${
                s.stat_direction === 'for'
                  ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
                  : 'bg-rose-500/20 text-rose-200 border-rose-500/40'
              }`}>
                {s.stat_direction === 'for' ? 'For' : 'Ag'}
              </span>
            ) : (
              <span className="w-8" />
            )}
          </button>
        ))}
      </div>

      <div className="px-3 py-2 border-t border-slate-800">
        <span className="text-xs text-slate-600">
          {allItems.length} statement{allItems.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
