'use client';

import { useMemo, useState } from 'react';
import { STAT_BADGE, STAT_LABEL } from './constants';
import type { FullStatement, Resolution } from './types';

export type StatMetrics = {
  id: string;
  updated_at: string;
  has_analysis: boolean;
  agree_count: number;
  disagree_count: number;
  vote_total_for: number;
  vote_total_against: number;
  weight_for: number;
  weight_against: number;
  user_vote: 'agree' | 'disagree' | null;
  chat_count: number;
  flag_count: number;
};

type SortKey = 'title' | 'type' | 'dir' | 'date' | 'vote' | 'for' | 'against' | 'weight' | 'chat';

type Props = {
  resolution: Resolution;
  statements: FullStatement[];
  selectedId: string | null;
  metricsMode: boolean;
  metrics: StatMetrics[] | null;
  onSelect: (id: string) => void;
  onToggleMetrics?: () => void;
  inline?: boolean;
};

function formatDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

export default function ListPanel({
  resolution, statements, selectedId, metricsMode, metrics, onSelect, onToggleMetrics, inline,
}: Props) {
  const [filter,  setFilter]  = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const metricsMap = useMemo(() => {
    if (!metrics) return null;
    return new Map(metrics.map(m => [m.id, m]));
  }, [metrics]);

  const allItems = useMemo(() => [
    {
      id: resolution.id, stat_type: 'resolution', stat_title: resolution.stat_title,
      stat_direction: null as string | null, retracted_at: null as string | null,
    },
    ...statements.map(s => ({
      id: s.id, stat_type: s.stat_type, stat_title: s.stat_title,
      stat_direction: s.stat_direction, retracted_at: s.retracted_at,
    })),
  ], [resolution, statements]);

  function handleSort(key: SortKey) {
    setSortDir(prev => sortKey === key ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
    setSortKey(key);
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return <span className="text-slate-700 ml-0.5">↕</span>;
    return <span className="text-blue-400 ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  const sorted = useMemo(() => {
    let items = filter
      ? allItems.filter(s => s.stat_title.toLowerCase().includes(filter.toLowerCase()))
      : [...allItems];

    if (!sortKey) return items;

    return items.sort((a, b) => {
      const ma = metricsMap?.get(a.id);
      const mb = metricsMap?.get(b.id);
      let cmp = 0;
      switch (sortKey) {
        case 'title': cmp = a.stat_title.localeCompare(b.stat_title); break;
        case 'type':  cmp = a.stat_type.localeCompare(b.stat_type); break;
        case 'dir':   cmp = (a.stat_direction ?? '').localeCompare(b.stat_direction ?? ''); break;
        case 'date':  cmp = (ma?.updated_at ?? '').localeCompare(mb?.updated_at ?? ''); break;
        case 'vote':  cmp = (ma?.user_vote ?? '').localeCompare(mb?.user_vote ?? ''); break;
        case 'for':   cmp = (ma?.vote_total_for ?? 0) - (mb?.vote_total_for ?? 0); break;
        case 'against': cmp = (ma?.vote_total_against ?? 0) - (mb?.vote_total_against ?? 0); break;
        case 'weight':  cmp = (ma?.weight_for ?? 0) - (mb?.weight_for ?? 0); break;
        case 'chat':    cmp = (ma?.chat_count ?? 0) - (mb?.chat_count ?? 0); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [allItems, filter, sortKey, sortDir, metricsMap]);

  const colCls = 'text-xs font-bold uppercase tracking-widest text-slate-600 cursor-pointer hover:text-slate-400 select-none whitespace-nowrap text-left';

  const GRID_METRICS = '1fr 56px 40px 72px 30px 34px 30px 30px 58px 42px';
  const GRID_SIMPLE  = '1fr auto auto';

  return (
    <div
      className={inline
        ? 'flex flex-col h-full overflow-hidden bg-[#080d1a]'
        : `flex-shrink-0 flex flex-col border-r border-slate-800 bg-[#080d1a] overflow-hidden transition-all duration-300 ${metricsMode ? 'w-[820px]' : 'w-80'}`
      }
      style={inline && metricsMode ? { minWidth: '820px' } : undefined}
    >

      <div className="px-3 py-2.5 border-b border-slate-800 flex items-center gap-2">
        <input
          type="text"
          placeholder="Filter statements…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="flex-1 rounded-lg border border-slate-800 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-blue-500/50 focus:outline-none"
        />
        {onToggleMetrics && (
          <button
            onClick={onToggleMetrics}
            title={metricsMode ? 'Hide metrics' : 'Show metrics'}
            className={`flex-shrink-0 rounded-lg p-1.5 border transition-colors ${
              metricsMode
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-slate-800/60 border-slate-700 text-slate-500 hover:text-slate-300'
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
          </button>
        )}
      </div>

      {/* Column headers */}
      {metricsMode ? (
        <div className="grid items-center px-3 py-2 border-b border-slate-800 gap-1"
          style={{ gridTemplateColumns: GRID_METRICS }}>
          <button className={colCls} onClick={() => handleSort('title')}>Statement {sortIndicator('title')}</button>
          <button className={colCls} onClick={() => handleSort('type')}>Type {sortIndicator('type')}</button>
          <button className={colCls} onClick={() => handleSort('dir')}>Dir {sortIndicator('dir')}</button>
          <button className={colCls} onClick={() => handleSort('date')}>Date {sortIndicator('date')}</button>
          <span className={`${colCls} cursor-default`} title="Scientific analysis available">
            <svg className="h-3.5 w-3.5 inline" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15a2.25 2.25 0 0 1 .45 1.32v.74c0 .513.416.929.93.929h.12a.93.93 0 0 0 .93-.93v-.74A2.25 2.25 0 0 1 21.68 15M19.8 15H4.2" />
            </svg>
          </span>
          <button className={colCls} onClick={() => handleSort('vote')}>Vote {sortIndicator('vote')}</button>
          <button className={colCls} onClick={() => handleSort('for')} title="Votes for"><span className="text-emerald-400 text-sm">✓</span>{sortIndicator('for')}</button>
          <button className={colCls} onClick={() => handleSort('against')} title="Votes against"><span className="text-rose-500 text-sm">✗</span>{sortIndicator('against')}</button>
          <button className={colCls} onClick={() => handleSort('weight')}>Wt F/A {sortIndicator('weight')}</button>
          <button className={colCls} onClick={() => handleSort('chat')}>Chat {sortIndicator('chat')}</button>
        </div>
      ) : (
        <div className="grid items-center px-3 py-2 border-b border-slate-800 gap-1"
          style={{ gridTemplateColumns: GRID_SIMPLE }}>
          <button className={colCls} onClick={() => handleSort('title')}>Statement {sortIndicator('title')}</button>
          <button className={colCls} onClick={() => handleSort('type')}>Type {sortIndicator('type')}</button>
          <button className={colCls} onClick={() => handleSort('dir')}>Dir {sortIndicator('dir')}</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto" style={inline ? { overscrollBehavior: 'none' } : undefined}>
        {sorted.map(s => {
          const m = metricsMap?.get(s.id);
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`w-full text-left border-b border-slate-800/60 transition-colors ${
                s.id === selectedId
                  ? 'bg-blue-500/10 border-l-2 border-l-blue-500'
                  : 'hover:bg-slate-800/40'
              } ${metricsMode ? 'px-3 py-2' : 'px-3 py-2.5'}`}
            >
              {metricsMode ? (
                <div className="grid gap-1 items-center"
                  style={{ gridTemplateColumns: GRID_METRICS }}>
                  <span className={`text-sm truncate leading-snug ${s.retracted_at ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                    {s.stat_title}
                  </span>
                  <span className={`rounded px-1 py-0.5 text-xs font-bold border ${STAT_BADGE[s.stat_type] ?? STAT_BADGE.claim}`}>
                    {STAT_LABEL[s.stat_type]?.slice(0, 4) ?? s.stat_type.slice(0, 4)}
                  </span>
                  {s.stat_direction === 'for'
                    ? <span className="text-emerald-400 text-base font-bold leading-none">✓</span>
                    : s.stat_direction === 'against'
                    ? <span className="text-rose-500 text-base font-bold leading-none">✗</span>
                    : <span />}
                  <span className="text-xs text-slate-500">{m ? formatDate(m.updated_at) : '—'}</span>
                  <span title={m?.has_analysis ? 'Analysis available' : 'No analysis'}>
                    {m?.has_analysis
                      ? <svg className="h-4 w-4 text-teal-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15a2.25 2.25 0 0 1 .45 1.32v.74c0 .513.416.929.93.929h.12a.93.93 0 0 0 .93-.93v-.74A2.25 2.25 0 0 1 21.68 15M19.8 15H4.2" /></svg>
                      : <span className="text-slate-700 text-xs">—</span>}
                  </span>
                  {m?.user_vote === 'agree'
                    ? <span className="text-emerald-400 text-base font-bold leading-none">✓</span>
                    : m?.user_vote === 'disagree'
                    ? <span className="text-rose-400 text-base font-bold leading-none">✗</span>
                    : <span className="text-slate-700 text-xs">—</span>}
                  <span className="text-xs font-mono">{(m?.vote_total_for ?? 0) > 0 ? <span className="text-blue-300">{m!.vote_total_for}</span> : <span className="text-slate-700">—</span>}</span>
                  <span className="text-xs font-mono">{(m?.vote_total_against ?? 0) > 0 ? <span className="text-orange-300">{m!.vote_total_against}</span> : <span className="text-slate-700">—</span>}</span>
                  <span className="text-xs text-slate-400 font-mono">
                    {m && (m.weight_for > 0 || m.weight_against > 0) ? `${m.weight_for}/${m.weight_against}` : <span className="text-slate-700">—</span>}
                  </span>
                  <span className="text-xs font-mono">{(m?.chat_count ?? 0) > 0 ? <span className="text-violet-300">{m!.chat_count}</span> : <span className="text-slate-700">—</span>}</span>
                </div>
              ) : (
                <div className="grid items-center gap-2" style={{ gridTemplateColumns: GRID_SIMPLE }}>
                  <span className={`text-sm truncate leading-snug min-w-0 ${s.retracted_at ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                    {s.stat_title}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-xs font-bold border flex-shrink-0 ${STAT_BADGE[s.stat_type] ?? STAT_BADGE.claim}`}>
                    {STAT_LABEL[s.stat_type]?.slice(0, 4) ?? s.stat_type.slice(0, 4)}
                  </span>
                  {s.stat_direction === 'for'
                    ? <span className="text-emerald-400 text-base font-bold leading-none flex-shrink-0">✓</span>
                    : s.stat_direction === 'against'
                    ? <span className="text-rose-500 text-base font-bold leading-none flex-shrink-0">✗</span>
                    : <span className="w-4 flex-shrink-0" />}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="px-3 py-2 border-t border-slate-800">
        <span className="text-xs text-slate-600">
          {allItems.length} statement{allItems.length !== 1 ? 's' : ''}
          {metricsMode && ' · Metrics'}
        </span>
      </div>
    </div>
  );
}
