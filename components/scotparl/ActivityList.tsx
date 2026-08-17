'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import type { UpdateItem } from '@/app/scotparl/page';
import type { ScotparlFavs } from '@/app/api/user/scotparl-favs/route';

const TYPE_BAR: Record<string, string> = {
  Proposal:  'bg-violet-500',
  Debate:    'bg-blue-500',
  Vote:      'bg-emerald-500',
  Act:       'bg-amber-500',
  Bill:      'bg-sky-500',
  SSI:       'bg-teal-500',
  Principle: 'bg-rose-500',
};

const TYPE_LABEL: Record<string, string> = {
  Proposal:  'text-violet-400',
  Debate:    'text-blue-400',
  Vote:      'text-emerald-400',
  Act:       'text-amber-400',
  Bill:      'text-sky-400',
  SSI:       'text-teal-400',
  Principle: 'text-rose-400',
};

function fmt(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isFavourited(item: UpdateItem, favs: ScotparlFavs): boolean {
  const id = item.entity_id;
  switch (item.item_type) {
    case 'Bill':  return favs.bills.includes(Number(id));
    case 'Proposal': return favs.proposals.includes(Number(id));
    case 'Debate':   return favs.debates.includes(id);
    case 'Principle': return favs.principles.includes(Number(id));
    default: return false;
  }
}

const FAVOURITABLE = new Set(['Bill', 'Proposal', 'Debate', 'Principle']);

export default function ActivityList({
  updates,
  since,
  sinceLabel,
  isLoggedIn,
}: {
  updates: UpdateItem[];
  since: string | null;
  sinceLabel: string | null;
  isLoggedIn: boolean;
}) {
  const [favsOnly, setFavsOnly] = useState(false);
  const [favs, setFavs] = useState<ScotparlFavs | null>(null);
  const [loadingFavs, setLoadingFavs] = useState(false);

  useEffect(() => {
    if (!favsOnly || !isLoggedIn) return;
    if (favs) return; // already loaded
    setLoadingFavs(true);
    fetch('/api/user/scotparl-favs')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setFavs(d); })
      .catch(() => {})
      .finally(() => setLoadingFavs(false));
  }, [favsOnly, isLoggedIn, favs]);

  const displayed = useMemo(() => {
    if (!favsOnly || !favs) return updates;
    return updates.filter(u => isFavourited(u, favs));
  }, [updates, favsOnly, favs]);

  if (updates.length === 0) return null;

  return (
    <div className="card-dr">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 flex-wrap gap-2">
        <h2 className="text-base font-semibold text-slate-100">
          {since ? `All changes since ${sinceLabel}` : 'Recent Updates'}
        </h2>
        <div className="flex items-center gap-3">
          {!since && <span className="text-xs text-slate-600">15 most recent</span>}
          {isLoggedIn && (
            <button
              onClick={() => setFavsOnly(f => !f)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                favsOnly
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
              }`}
            >
              <svg className="h-3 w-3" fill={favsOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
              Favourites
              {loadingFavs && <span className="text-slate-600">…</span>}
            </button>
          )}
        </div>
      </div>
      {displayed.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500 text-center">
          {favsOnly ? 'No favourites in this list.' : 'No items.'}
        </p>
      ) : (
        <ul className="divide-y divide-slate-800/60">
          {displayed.map((u, i) => {
            const isExternal = u.url.startsWith('http');
            const barCls = TYPE_BAR[u.item_type] ?? 'bg-slate-500';
            const lblCls = TYPE_LABEL[u.item_type] ?? 'text-slate-400';
            const inner = (
              <div className="flex items-center gap-3 pl-5 pr-4 py-3 hover:bg-slate-800/40 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-200 truncate">{u.name}</p>
                  <p className={`text-[10px] font-semibold mt-0.5 ${lblCls}`}>{u.item_type}</p>
                </div>
                <div className="flex-shrink-0 text-right hidden sm:block">
                  <p className="text-xs text-slate-600">{fmt(u.changed_at)}</p>
                </div>
              </div>
            );
            return (
              <li key={i} className="relative">
                <div className={`absolute inset-y-0 left-0 w-1 ${barCls}`} />
                {isExternal ? (
                  <a href={u.url} target="_blank" rel="noopener noreferrer">{inner}</a>
                ) : (
                  <Link href={u.url}>{inner}</Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
