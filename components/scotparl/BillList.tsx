'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

export type Bill = {
  id: number;
  reference: string | null;
  short_name: string;
  full_name: string;
  bill_type: string | null;
  sponsor_name: string | null;
  sponsor_preferred: string | null;
  third_party_organisation: string | null;
  current_stage: string | null;
  latest_stage_date: string | null;
  resolution_id: string | null;
  debate_status: string | null;
  debate_votes_for: number;
  debate_votes_against: number;
  debate_chat_count: number;
  debate_request_count: number;
  pvc_poll_id: string | null;
  synopsis: string | null;
  session_slug: string | null;
};

function fmt(date: string | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function parliamentUrl(shortName: string, sessionSlug: string | null): string | null {
  if (!sessionSlug) return null;
  const slug = shortName
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `https://www.parliament.scot/bills-and-laws/bills/${sessionSlug}/${slug}`;
}

const STAGE_KEYS: [string, string][] = [
  ['Royal Assent',  'bg-amber-500/10 text-amber-300 border-amber-500/20'],
  ['Passed',        'bg-teal-500/10 text-teal-300 border-teal-500/20'],
  ['Stage 3',       'bg-violet-500/10 text-violet-300 border-violet-500/20'],
  ['Stage 2',       'bg-blue-500/10 text-blue-300 border-blue-500/20'],
  ['Stage 1',       'bg-sky-500/10 text-sky-300 border-sky-500/20'],
  ['Introduced',    'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'],
  ['Withdrawn',     'bg-slate-500/10 text-slate-400 border-slate-500/20'],
  ['Rejected',      'bg-rose-500/10 text-rose-300 border-rose-500/20'],
];

function stageBadge(stage: string | null) {
  if (!stage) return 'bg-slate-700/30 text-slate-400 border-slate-600/20';
  const s = stage.toLowerCase();
  for (const [k, v] of STAGE_KEYS) {
    if (s.includes(k.toLowerCase())) return v;
  }
  return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
}

function HeartIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-rose-400 text-rose-400" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-slate-500 hover:stroke-rose-400 transition-colors" strokeWidth={1.8} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function BillList({
  bills,
  types,
  stages,
  years,
  userId,
  initialFavIds,
}: {
  bills: Bill[];
  types: string[];
  stages: string[];
  years: number[];
  userId: string | null;
  initialFavIds: number[];
}) {
  const [search, setSearch]     = useState('');
  const [typeFilter, setType]   = useState('');
  const [stageFilter, setStage] = useState('');
  const [yearFilter, setYear]   = useState<number | ''>('');
  const [favsOnly,     setFavsOnly]     = useState(false);
  const [debateOnly,   setDebateOnly]   = useState(false);

  const minDate = useMemo(() => {
    const dates = bills
      .map(b => b.latest_stage_date ? new Date(b.latest_stage_date).toISOString().slice(0, 10) : null)
      .filter(Boolean) as string[];
    return dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : '';
  }, [bills]);
  const todayStr = new Date().toISOString().split('T')[0];

  const [dateFrom, setDateFrom] = useState(() => {
    const dates = bills
      .map(b => b.latest_stage_date ? new Date(b.latest_stage_date).toISOString().slice(0, 10) : null)
      .filter(Boolean) as string[];
    return dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : '';
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  const [favIds, setFavIds] = useState<Set<number>>(() => new Set(initialFavIds));

  async function toggleFav(e: React.MouseEvent, billId: number) {
    e.preventDefault();
    e.stopPropagation();
    if (!userId) return;
    const isNowFav = !favIds.has(billId);
    setFavIds(prev => {
      const next = new Set(prev);
      isNowFav ? next.add(billId) : next.delete(billId);
      return next;
    });
    try {
      await fetch(`/api/scotparl/bills/${billId}/favourite`, { method: 'POST' });
    } catch {
      setFavIds(prev => {
        const next = new Set(prev);
        isNowFav ? next.delete(billId) : next.add(billId);
        return next;
      });
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return bills.filter(b => {
      if (typeFilter  && b.bill_type     !== typeFilter)  return false;
      if (stageFilter && b.current_stage !== stageFilter) return false;
      if (yearFilter) {
        if (!b.latest_stage_date) return false;
        if (new Date(b.latest_stage_date).getFullYear() !== yearFilter) return false;
      }
      if (dateFrom || dateTo) {
        const d = b.latest_stage_date
          ? new Date(b.latest_stage_date).toISOString().slice(0, 10)
          : null;
        if (d) {
          if (dateFrom && d < dateFrom) return false;
          if (dateTo   && d > dateTo)   return false;
        }
      }
      if (favsOnly   && !favIds.has(b.id))          return false;
      if (debateOnly && b.debate_status !== 'active') return false;
      if (!q) return true;
      return (
        b.short_name.toLowerCase().includes(q) ||
        b.full_name.toLowerCase().includes(q) ||
        (b.reference ?? '').toLowerCase().includes(q) ||
        (b.sponsor_name ?? '').toLowerCase().includes(q) ||
        (b.synopsis ?? '').toLowerCase().includes(q)
      );
    });
  }, [bills, search, typeFilter, stageFilter, yearFilter, dateFrom, dateTo, favsOnly, favIds]);

  const dateFiltersChanged = dateFrom !== minDate || dateTo !== todayStr;
  const hasFilters = !!(search || typeFilter || stageFilter || yearFilter || favsOnly || debateOnly || dateFiltersChanged);

  function clearFilters() {
    setSearch('');
    setType('');
    setStage('');
    setYear('');
    setFavsOnly(false);
    setDebateOnly(false);
    setDateFrom(minDate);
    setDateTo(todayStr);
  }

  return (
    <div className="space-y-4">
      {/* Row 1: text search + dropdowns */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="Search bills…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={typeFilter}
          onChange={e => setType(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 focus:border-blue-500 focus:outline-none"
        >
          <option value="">All types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={stageFilter}
          onChange={e => setStage(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 focus:border-blue-500 focus:outline-none"
        >
          <option value="">All stages</option>
          {stages.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={yearFilter}
          onChange={e => setYear(e.target.value ? Number(e.target.value) : '')}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 focus:border-blue-500 focus:outline-none"
        >
          <option value="">All years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Row 2: date range + favourites */}
      <div className="flex flex-col sm:flex-row gap-2 items-center">
        <div className="flex items-center gap-2 flex-1">
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
        <button
          onClick={() => setDebateOnly(d => !d)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
            debateOnly
              ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
              : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-300'
          }`}
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9h8M8 13h5m-9 7 4-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3l-4 4Z" />
          </svg>
          Active Debate
        </button>
        {userId && (
          <button
            onClick={() => setFavsOnly(f => !f)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
              favsOnly
                ? 'border-rose-500/50 bg-rose-500/10 text-rose-300'
                : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-300'
            }`}
          >
            <HeartIcon filled={favsOnly} />
            Favourites
          </button>
        )}
      </div>

      <p className="text-xs text-slate-600">
        Showing {filtered.length} of {bills.length} bills
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="ml-2 text-blue-500 hover:text-blue-400 underline underline-offset-2"
          >
            Clear filters
          </button>
        )}
      </p>

      <div className="card-dr divide-y divide-slate-800/60">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-sm">No bills match your filters.</div>
        ) : filtered.map(b => (
          <div key={b.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-800/40 transition-colors">
            <Link href={`/scotparl/bills/${b.id}`} className="flex-1 min-w-0">
              {/* Line 1: title */}
              <p className="text-sm font-medium text-slate-100 leading-snug">{b.short_name}</p>
              {/* Line 2: metadata */}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {b.bill_type && <span className="text-xs text-slate-500">{b.bill_type}</span>}
                {b.reference  && <span className="text-xs text-slate-600">{b.reference}</span>}
                {(b.sponsor_preferred || b.sponsor_name) && (
                  <span className="text-xs text-slate-500">
                    {b.sponsor_preferred ?? b.sponsor_name?.split(',').reverse().join(' ').trim()}
                  </span>
                )}
                {b.third_party_organisation && (
                  <span className="text-xs text-slate-500">{b.third_party_organisation}</span>
                )}
                {b.latest_stage_date && <span className="text-xs text-slate-600">{fmt(b.latest_stage_date)}</span>}
                {b.resolution_id && b.debate_status === 'active' && (
                  <span className="inline-flex items-center rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300 border border-blue-500/20">
                    Open Debate
                  </span>
                )}
                {b.resolution_id && b.debate_status !== 'active' && (
                  <span className="inline-flex items-center rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 border border-slate-600/30">
                    Closed Debate
                  </span>
                )}
                {!b.resolution_id && b.debate_request_count > 0 && (
                  <span className="inline-flex items-center rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400/80 border border-amber-500/20">
                    {b.debate_request_count} {b.debate_request_count === 1 ? 'request' : 'requests'}
                  </span>
                )}
                {b.pvc_poll_id && (
                  <span className="inline-flex items-center rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/20">
                    Vote
                  </span>
                )}
              </div>
              {/* Lines 3–4: synopsis excerpt */}
              {b.synopsis && (
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-2">{b.synopsis}</p>
              )}
            </Link>
            {/* Right column: Full Bill link + stage badge + favourite */}
            <div className="flex flex-col items-end gap-2 flex-shrink-0 pt-0.5">
              {parliamentUrl(b.short_name, b.session_slug) && (
                <a
                  href={parliamentUrl(b.short_name, b.session_slug)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="inline-flex items-center gap-0.5 rounded border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-300 hover:bg-blue-500/20 transition-colors"
                >
                  Full Bill
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
              {b.current_stage && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${stageBadge(b.current_stage)}`}>
                  {b.current_stage}
                </span>
              )}
              {userId && (
                <button
                  onClick={e => toggleFav(e, b.id)}
                  aria-label={favIds.has(b.id) ? 'Remove from favourites' : 'Add to favourites'}
                  className="p-0.5 rounded hover:bg-slate-700/50 transition-colors"
                >
                  <HeartIcon filled={favIds.has(b.id)} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
