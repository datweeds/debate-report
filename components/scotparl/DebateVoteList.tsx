'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';

export type DebateVoteItem = {
  id: string;
  kind: 'debate' | 'vote';
  title: string;
  status: string;          // 'open' | 'closed'
  votes_for: number;
  votes_against: number;
  chat_count: number;
  created_at: string;
  closes_at: string | null;
  entity_type: string;
  entity_id: string;
  entity_title: string;
  topic_id: number | null;
  topic_name: string | null;
};

const PVC_BASE = 'https://poll.voter.care';

function fmt(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ResultBar({ vFor, vAgainst }: { vFor: number; vAgainst: number }) {
  const total = vFor + vAgainst;
  if (total === 0) return null;
  const pFor = Math.round((vFor / total) * 100);
  return (
    <div className="mt-1.5 flex items-center gap-2 text-[10px]">
      <div className="flex-1 max-w-[80px] rounded-full overflow-hidden h-1 bg-slate-700 flex">
        <div className="bg-emerald-500" style={{ width: `${pFor}%` }} />
        <div className="bg-rose-500"    style={{ width: `${100 - pFor}%` }} />
      </div>
      <span className="text-emerald-400">{vFor}↑</span>
      <span className="text-rose-400">{vAgainst}↓</span>
      <span className="text-slate-600">·</span>
      <span className="text-slate-500">{total} votes</span>
    </div>
  );
}

function ItemCard({ item, isFav, onFavToggle }: { item: DebateVoteItem; isFav: boolean; onFavToggle: (e: React.MouseEvent, id: string) => void }) {
  const entityHref = `${item.entity_type === 'bill' ? '/scotparl/bills/' : '/scotparl/proposals/'}${item.entity_id}`;
  const itemHref   = item.kind === 'debate'
    ? `/chamber?resolution=${item.id}`
    : `${PVC_BASE}/vote/${item.id}`;
  const isOpen     = item.status === 'open';

  return (
    <div className="px-5 py-4 flex gap-4 items-start hover:bg-slate-800/30 transition-colors">
      <div className="flex-1 min-w-0">
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${
            item.kind === 'debate'
              ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
              : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
          }`}>
            {item.kind === 'debate' ? 'Debate' : 'Vote'}
          </span>
          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold border ${
            isOpen
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
              : 'bg-slate-500/10 text-slate-400 border-slate-600/30'
          }`}>
            {isOpen ? 'Open' : 'Closed'}
          </span>
        </div>

        {/* Title */}
        <p className="text-sm font-medium text-slate-100 leading-snug mb-1">{item.title}</p>

        {/* Entity link */}
        <Link
          href={entityHref}
          className="text-[11px] text-blue-400/70 hover:text-blue-400 transition-colors"
        >
          {item.entity_type === 'bill' ? 'Bill' : 'Proposal'}: {item.entity_title} →
        </Link>

        {/* Metrics */}
        {(item.kind === 'debate' || item.status === 'closed')
          ? <ResultBar vFor={item.votes_for} vAgainst={item.votes_against} />
          : (item.votes_for + item.votes_against > 0 && (
              <p className="mt-1 text-[10px] text-slate-500">{item.votes_for + item.votes_against} votes cast</p>
            ))
        }

        {/* Date row */}
        <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-slate-500">
          <span>Opened {fmt(item.created_at)}</span>
          {item.kind === 'debate' && item.chat_count > 0 && (
            <>
              <span>·</span>
              <span>{item.chat_count} comments</span>
            </>
          )}
          {item.kind === 'vote' && item.closes_at && (
            <>
              <span>·</span>
              <span>{isOpen ? 'Closes' : 'Closed'} {fmt(item.closes_at)}</span>
            </>
          )}
        </div>
      </div>

      {/* Right column: fav + action */}
      <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
        {item.kind === 'debate' && (
          <button
            onClick={e => onFavToggle(e, item.id)}
            aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
            className={`rounded-full p-1 transition-colors ${isFav ? 'text-rose-400 hover:text-rose-300' : 'text-slate-600 hover:text-rose-400'}`}
          >
            <svg className="h-4 w-4" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
            </svg>
          </button>
        )}
        <a
          href={itemHref}
          target={item.kind === 'vote' ? '_blank' : undefined}
          rel={item.kind === 'vote' ? 'noopener noreferrer' : undefined}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            isOpen
              ? item.kind === 'debate'
                ? 'bg-blue-600/80 hover:bg-blue-600 text-white'
                : 'bg-amber-600/80 hover:bg-amber-600 text-white'
              : 'border border-slate-600/50 text-slate-400 hover:text-slate-200 hover:border-slate-500'
          }`}
        >
          {item.kind === 'debate' ? 'Open →' : 'Vote →'}
        </a>
      </div>
    </div>
  );
}

type KindFilter   = 'all' | 'debate' | 'vote';
type StatusFilter = 'all' | 'open'   | 'closed';

export default function DebateVoteList({ items, topics = [], isLoggedIn = false }: { items: DebateVoteItem[]; topics?: { id: number; name: string }[]; isLoggedIn?: boolean }) {
  const [search,      setSearch]      = useState('');
  const [kind,        setKind]        = useState<KindFilter>('all');
  const [status,      setStatus]      = useState<StatusFilter>('all');
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [favsOnly,    setFavsOnly]    = useState(false);
  const [favIds,      setFavIds]      = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch('/api/user/scotparl-favs')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.debates) setFavIds(new Set(d.debates)); })
      .catch(() => {});
  }, [isLoggedIn]);

  async function toggleFav(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const res = await fetch(`/api/statements/${id}/favourite`, { method: 'POST' });
    if (res.ok) {
      const d = await res.json();
      setFavIds(prev => {
        const next = new Set(prev);
        if (d.isFavourite) next.add(id); else next.delete(id);
        return next;
      });
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(item => {
      if (kind   !== 'all' && item.kind   !== kind)   return false;
      if (status !== 'all' && item.status !== status) return false;
      if (topicFilter && item.topic_id !== Number(topicFilter)) return false;
      if (favsOnly && !favIds.has(item.id)) return false;
      if (dateFrom) {
        if (new Date(item.created_at).toISOString().slice(0, 10) < dateFrom) return false;
      }
      if (dateTo) {
        if (new Date(item.created_at).toISOString().slice(0, 10) > dateTo) return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.entity_title.toLowerCase().includes(q)
      );
    });
  }, [items, search, kind, status, dateFrom, dateTo, topicFilter]);

  const hasFilters = !!(search || kind !== 'all' || status !== 'all' || dateFrom || dateTo || topicFilter || favsOnly);

  function clearFilters() {
    setSearch('');
    setKind('all');
    setStatus('all');
    setDateFrom('');
    setDateTo('');
    setTopicFilter('');
    setFavsOnly(false);
  }

  function ToggleGroup<T extends string>({ value, options, onChange }: {
    value: T; options: { v: T; label: string }[]; onChange: (v: T) => void;
  }) {
    return (
      <div className="flex rounded-lg border border-slate-700 overflow-hidden">
        {options.map(o => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={`px-3 py-2 text-xs font-medium transition-colors ${
              value === o.v
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Search by title…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[180px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <ToggleGroup<KindFilter>
          value={kind}
          options={[{ v: 'all', label: 'All' }, { v: 'debate', label: 'Debates' }, { v: 'vote', label: 'Votes' }]}
          onChange={setKind}
        />
        <ToggleGroup<StatusFilter>
          value={status}
          options={[{ v: 'all', label: 'All' }, { v: 'open', label: 'Open' }, { v: 'closed', label: 'Closed' }]}
          onChange={setStatus}
        />
        {isLoggedIn && (
          <button
            onClick={() => setFavsOnly(f => !f)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
              favsOnly
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'border border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <svg className="h-3 w-3" fill={favsOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
            </svg>
            Favourites
          </button>
        )}
      </div>
      {topics.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={topicFilter}
            onChange={e => setTopicFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-slate-500"
          >
            <option value="">All Topics</option>
            {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <label className="text-xs text-slate-500 whitespace-nowrap">From</label>
        <input
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 focus:border-blue-500 focus:outline-none [color-scheme:dark]"
        />
        <label className="text-xs text-slate-500 whitespace-nowrap">To</label>
        <input
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 focus:border-blue-500 focus:outline-none [color-scheme:dark]"
        />
      </div>

      <p className="text-xs text-slate-600">
        {filtered.length} of {items.length} items
        {hasFilters && (
          <button onClick={clearFilters} className="ml-2 text-blue-500 hover:text-blue-400 underline underline-offset-2">
            Clear filters
          </button>
        )}
      </p>

      {/* List */}
      <div className="card-dr divide-y divide-slate-800/60">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-sm">Nothing matches your filters.</div>
        ) : (
          filtered.map(item => <ItemCard key={`${item.kind}-${item.id}`} item={item} isFav={favIds.has(item.id)} onFavToggle={toggleFav} />)
        )}
      </div>
    </div>
  );
}
