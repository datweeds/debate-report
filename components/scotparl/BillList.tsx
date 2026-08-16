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
  impact_score: number | null;
  impact_count: number;
};

export type Ssi = {
  id: number;
  year: number;
  number: number;
  title: string;
  url: string;
  pdf_url: string | null;
  enacted_at: string | null;
  procedure: string | null;
  subject: string | null;
};

export type Act = Omit<Ssi, 'procedure' | 'subject'>; // sp_acts has no procedure metadata

type LawItem =
  | ({ item_type: 'bill' } & Bill)
  | ({ item_type: 'ssi'  } & Ssi)
  | ({ item_type: 'act'  } & Act);

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

function ExternalIcon() {
  return (
    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

type TopicChip = { slug: string; score: number };

function TopicChips({ chips }: { chips: TopicChip[] }) {
  if (!chips || chips.length === 0) return null;
  return (
    <>
      {chips.map(c => {
        const cls =
          c.score >= 7 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                         'bg-amber-500/10  text-amber-300  border-amber-500/20';
        const label = c.slug.charAt(0).toUpperCase() + c.slug.slice(1);
        return (
          <span
            key={c.slug}
            title={`AI relevance to ${label}: ${c.score}/10`}
            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold border ${cls}`}
          >
            {label} {c.score}
          </span>
        );
      })}
    </>
  );
}

function FlagIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} xmlns="http://www.w3.org/2000/svg">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="4" y1="22" x2="4" y2="15" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
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

function toDateStr(v: string | Date | null | undefined): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v;
}

function itemDate(item: LawItem): string | null {
  return item.item_type === 'bill'
    ? toDateStr(item.latest_stage_date)
    : toDateStr(item.enacted_at);
}

export default function BillList({
  bills,
  ssis  = [],
  acts  = [],
  types,
  stages,
  years,
  userId,
  initialFavIds,
  lightTopics = {},
  topics = [],
  initialFlaggedKeys = [],
  isManager = false,
}: {
  bills: Bill[];
  ssis?:  Ssi[];
  acts?:  Act[];
  types: string[];
  stages: string[];
  years: number[];
  userId: string | null;
  initialFavIds: number[];
  lightTopics?: Record<string, TopicChip[]>;
  topics?: { slug: string; name: string }[];
  initialFlaggedKeys?: string[];
  isManager?: boolean;
}) {
  const [search,          setSearch]      = useState('');
  const [typeFilter,      setType]        = useState('');
  const [stageFilter,     setStage]       = useState('');
  const [procedureFilter, setProcedure]   = useState('');
  const [yearFilter,      setYear]        = useState<number | ''>('');
  const [topicFilter,     setTopicFilter] = useState('');
  const [favsOnly,        setFavsOnly]  = useState(false);
  const [debateOnly,      setDebateOnly]= useState(false);
  const [lawKind,         setLawKind]   = useState<'all' | 'act' | 'bill' | 'ssi'>('all');

  const allItems = useMemo<LawItem[]>(() => {
    const bs: LawItem[] = bills.map(b => ({ item_type: 'bill' as const, ...b }));
    const ss: LawItem[] = ssis.map(s  => ({ item_type: 'ssi'  as const, ...s }));
    const as_: LawItem[] = acts.map(a => ({ item_type: 'act'  as const, ...a }));
    return [...as_, ...bs, ...ss].sort((a, b) => {
      const da = itemDate(a) ?? '0';
      const db = itemDate(b) ?? '0';
      return db.localeCompare(da);
    });
  }, [bills, ssis, acts]);

  const todayStr = new Date().toISOString().split('T')[0];
  const defaultFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().slice(0, 10);
  }, []);

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo,   setDateTo]   = useState(todayStr);

  const [favIds, setFavIds]     = useState<Set<number>>(() => new Set(initialFavIds));
  const [flagged, setFlagged]   = useState<Set<string>>(() => new Set(initialFlaggedKeys));

  async function toggleFlag(e: React.MouseEvent, entityType: string, entityId: number) {
    e.preventDefault(); e.stopPropagation();
    if (!isManager) return;
    const key = `${entityType}:${entityId}`;
    const willFlag = !flagged.has(key);
    setFlagged(prev => { const n = new Set(prev); willFlag ? n.add(key) : n.delete(key); return n; });
    try {
      await fetch('/api/scotparl/nsp/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId }),
      });
    } catch {
      setFlagged(prev => { const n = new Set(prev); willFlag ? n.delete(key) : n.add(key); return n; });
    }
  }

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
    return allItems.filter(item => {
      if (lawKind !== 'all' && item.item_type !== lawKind) return false;

      if (topicFilter) {
        const key = `${item.item_type}:${item.id}`;
        if (!lightTopics[key]?.some(c => c.slug === topicFilter)) return false;
      }

      if (item.item_type === 'bill') {
        if (typeFilter  && item.bill_type     !== typeFilter)  return false;
        if (stageFilter && item.current_stage !== stageFilter) return false;
        if (favsOnly    && !favIds.has(item.id))               return false;
        if (debateOnly  && item.debate_status !== 'active')    return false;
      }

      if (item.item_type === 'ssi') {
        if (procedureFilter && item.procedure !== procedureFilter) return false;
      }

      if (yearFilter) {
        const d = itemDate(item);
        if (!d) return false;
        if (new Date(d).getFullYear() !== yearFilter) return false;
      }

      const d = itemDate(item);
      if (d) {
        const ds = new Date(d).toISOString().slice(0, 10);
        if (dateFrom && ds < dateFrom) return false;
        if (dateTo   && ds > dateTo)   return false;
      }

      if (!q) return true;
      if (item.item_type === 'bill') {
        return (
          item.short_name.toLowerCase().includes(q) ||
          item.full_name.toLowerCase().includes(q) ||
          (item.reference ?? '').toLowerCase().includes(q) ||
          (item.sponsor_name ?? '').toLowerCase().includes(q) ||
          (item.synopsis ?? '').toLowerCase().includes(q)
        );
      }
      if (item.item_type === 'act') {
        return (
          item.title.toLowerCase().includes(q) ||
          `asp ${item.year}/${item.number}`.includes(q)
        );
      }
      // ssi
      return (
        item.title.toLowerCase().includes(q) ||
        `ssi ${item.year}/${item.number}`.includes(q)
      );
    });
  }, [allItems, search, lawKind, typeFilter, stageFilter, procedureFilter, yearFilter, dateFrom, dateTo, favsOnly, debateOnly, favIds, topicFilter, lightTopics]);

  const isDefaultWindow    = dateFrom === defaultFrom && dateTo === todayStr;
  const dateFiltersChanged = !isDefaultWindow;
  const hasFilters = !!(search || topicFilter || typeFilter || stageFilter || procedureFilter || yearFilter || favsOnly || debateOnly || dateFiltersChanged || lawKind !== 'all');
  const showBillFilters = lawKind === 'all' || lawKind === 'bill';
  const showSsiFilters  = lawKind === 'ssi';

  function clearFilters() {
    setSearch('');
    setTopicFilter('');
    setType('');
    setStage('');
    setProcedure('');
    setYear('');
    setFavsOnly(false);
    setDebateOnly(false);
    setDateFrom(defaultFrom);
    setDateTo(todayStr);
    setLawKind('all');
  }

  return (
    <div className="space-y-4">

      {/* Type toggle: All / Acts / Bills / SSIs */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { k: 'all',  label: 'All',   count: allItems.length, accent: 'border-slate-500 bg-slate-500/10 text-slate-300' },
          { k: 'act',  label: 'Acts',  count: acts.length,     accent: 'border-amber-500 bg-amber-500/10 text-amber-300' },
          { k: 'bill', label: 'Bills', count: bills.length,    accent: 'border-blue-500  bg-blue-500/10  text-blue-300'  },
          { k: 'ssi',  label: 'SSIs',  count: ssis.length,     accent: 'border-teal-500  bg-teal-500/10  text-teal-300'  },
        ] as const).map(({ k, label, count, accent }) => (
          <button
            key={k}
            onClick={() => setLawKind(k)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              lawKind === k ? accent : 'border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {label} <span className="opacity-60">{count}</span>
          </button>
        ))}
      </div>

      {/* Default-window notice */}
      {isDefaultWindow && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
          </svg>
          <span>Showing laws updated in the last 90 days</span>
          <button
            onClick={() => setDateFrom('')}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            Show all {allItems.length.toLocaleString()} →
          </button>
        </div>
      )}

      {/* Row 1: text search + bill dropdowns (hidden when SSI-only) */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder={
            lawKind === 'act'  ? 'Search acts…'  :
            lawKind === 'ssi'  ? 'Search SSIs…'  :
            lawKind === 'bill' ? 'Search bills…' : 'Search laws…'
          }
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {showBillFilters && (
          <>
            <select
              value={typeFilter}
              onChange={e => setType(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Bill types</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={stageFilter}
              onChange={e => setStage(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Bill stages</option>
              {stages.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </>
        )}
        {showSsiFilters && (
          <select
            value={procedureFilter}
            onChange={e => setProcedure(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 focus:border-teal-500 focus:outline-none"
          >
            <option value="">All procedures</option>
            <option value="negative">Negative (Laid)</option>
            <option value="affirmative">Affirmative (Approved)</option>
          </select>
        )}
        <select
          value={yearFilter}
          onChange={e => setYear(e.target.value ? Number(e.target.value) : '')}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 focus:border-blue-500 focus:outline-none"
        >
          <option value="">All years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {topics.length > 0 && (
          <select
            value={topicFilter}
            onChange={e => setTopicFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 focus:border-blue-500 focus:outline-none"
          >
            <option value="">All topics</option>
            {topics.map(t => <option key={t.slug} value={t.slug}>{t.name}</option>)}
          </select>
        )}
      </div>

      {/* Row 2: date range + bill-only buttons */}
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
        {showBillFilters && (
          <>
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
          </>
        )}
      </div>

      <p className="text-xs text-slate-600">
        Showing {filtered.length} of {allItems.length} laws
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
          <div className="py-10 text-center text-slate-500 text-sm">No laws match your filters.</div>
        ) : filtered.map(item =>
          item.item_type === 'act' ? (
            /* ── Act row ── */
            <div key={`act-${item.id}`} className="px-5 py-3 hover:bg-slate-800/40 transition-colors">
              <div className="flex items-baseline justify-between gap-3">
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-100 leading-snug hover:text-amber-200 transition-colors">{item.title}</span>
                </a>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center gap-0.5 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300 hover:bg-amber-500/20 transition-colors">
                    Read <ExternalIcon />
                  </a>
                  {item.pdf_url && (
                    <a href={item.pdf_url} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-0.5 rounded border border-slate-600/30 px-2 py-0.5 text-[10px] font-medium text-slate-500 hover:text-slate-300 transition-colors">
                      PDF <ExternalIcon />
                    </a>
                  )}
                  {isManager && (
                    <button onClick={e => toggleFlag(e, 'act', item.id)}
                      title={flagged.has(`act:${item.id}`) ? 'Flagged for deep analysis' : 'Flag for deep analysis'}
                      className={`p-0.5 rounded hover:bg-slate-700/50 transition-colors ${flagged.has(`act:${item.id}`) ? 'text-amber-400' : 'text-slate-600 hover:text-amber-300'}`}>
                      <FlagIcon filled={flagged.has(`act:${item.id}`)} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="inline-flex items-center rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/20">Act</span>
                <span className="font-mono text-[11px] text-slate-500">ASP {item.year}/{item.number}</span>
                {item.enacted_at && <span className="text-xs text-slate-600">{fmt(item.enacted_at)}</span>}
                {lightTopics[`act:${item.id}`] && <TopicChips chips={lightTopics[`act:${item.id}`]} />}
              </div>
            </div>
          ) : item.item_type === 'ssi' ? (
            /* ── SSI row ── */
            <div key={`ssi-${item.id}`} className="px-5 py-3 hover:bg-slate-800/40 transition-colors">
              <div className="flex items-baseline justify-between gap-3">
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-100 leading-snug hover:text-teal-200 transition-colors">{item.title}</span>
                </a>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center gap-0.5 rounded border border-teal-500/20 bg-teal-500/10 px-2 py-0.5 text-[10px] font-medium text-teal-300 hover:bg-teal-500/20 transition-colors">
                    Read <ExternalIcon />
                  </a>
                  {item.pdf_url && (
                    <a href={item.pdf_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                       className="inline-flex items-center gap-0.5 rounded border border-slate-600/30 px-2 py-0.5 text-[10px] font-medium text-slate-500 hover:text-slate-300 transition-colors">
                      PDF <ExternalIcon />
                    </a>
                  )}
                  {isManager && (
                    <button onClick={e => toggleFlag(e, 'ssi', item.id)}
                      title={flagged.has(`ssi:${item.id}`) ? 'Flagged for deep analysis' : 'Flag for deep analysis'}
                      className={`p-0.5 rounded hover:bg-slate-700/50 transition-colors ${flagged.has(`ssi:${item.id}`) ? 'text-amber-400' : 'text-slate-600 hover:text-amber-300'}`}>
                      <FlagIcon filled={flagged.has(`ssi:${item.id}`)} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="inline-flex items-center rounded bg-teal-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-teal-300 border border-teal-500/20">SSI</span>
                <span className="font-mono text-[11px] text-slate-500">SSI {item.year}/{item.number}</span>
                {item.procedure === 'affirmative' && (
                  <span className="inline-flex items-center rounded bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-300 border border-orange-500/20">Affirmative</span>
                )}
                {item.procedure === 'negative' && (
                  <span className="inline-flex items-center rounded bg-slate-700/40 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 border border-slate-600/30">Negative</span>
                )}
                {item.enacted_at && <span className="text-xs text-slate-600">{fmt(item.enacted_at)}</span>}
                {lightTopics[`ssi:${item.id}`] && <TopicChips chips={lightTopics[`ssi:${item.id}`]} />}
              </div>
            </div>
          ) : (
            /* ── Bill row ── */
            <div key={`bill-${item.id}`} className="px-5 py-3 hover:bg-slate-800/40 transition-colors" title={item.synopsis ?? undefined}>
              <div className="flex items-baseline justify-between gap-3">
                <Link href={`/scotparl/bills/${item.id}`} className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-100 leading-snug hover:text-blue-300 transition-colors">{item.short_name}</span>
                </Link>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {parliamentUrl(item.short_name, item.session_slug) && (
                    <a href={parliamentUrl(item.short_name, item.session_slug)!} target="_blank" rel="noopener noreferrer"
                       onClick={e => e.stopPropagation()}
                       className="inline-flex items-center gap-0.5 rounded border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-300 hover:bg-blue-500/20 transition-colors">
                      Full Bill <ExternalIcon />
                    </a>
                  )}
                  {userId && (
                    <button onClick={e => toggleFav(e, item.id)} aria-label={favIds.has(item.id) ? 'Remove from favourites' : 'Add to favourites'}
                      className="p-0.5 rounded hover:bg-slate-700/50 transition-colors">
                      <HeartIcon filled={favIds.has(item.id)} />
                    </button>
                  )}
                  {isManager && (
                    <button onClick={e => toggleFlag(e, 'bill', item.id)}
                      title={flagged.has(`bill:${item.id}`) ? 'Flagged for deep analysis' : 'Flag for deep analysis'}
                      className={`p-0.5 rounded hover:bg-slate-700/50 transition-colors ${flagged.has(`bill:${item.id}`) ? 'text-amber-400' : 'text-slate-600 hover:text-amber-300'}`}>
                      <FlagIcon filled={flagged.has(`bill:${item.id}`)} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="inline-flex items-center rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300 border border-blue-500/20">Bill</span>
                {item.bill_type && <span className="text-xs text-slate-500">{item.bill_type}</span>}
                {item.reference  && <span className="text-xs text-slate-600">{item.reference}</span>}
                {(item.sponsor_preferred || item.sponsor_name) && (
                  <span className="text-xs text-slate-500">{item.sponsor_preferred ?? item.sponsor_name?.split(',').reverse().join(' ').trim()}</span>
                )}
                {item.third_party_organisation && <span className="text-xs text-slate-500">{item.third_party_organisation}</span>}
                {item.latest_stage_date && <span className="text-xs text-slate-600">{fmt(item.latest_stage_date)}</span>}
                {item.resolution_id && item.debate_status === 'active' && (
                  <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300 border border-blue-500/20">
                    Open Debate
                    {(item.debate_votes_for > 0 || item.debate_votes_against > 0) && (
                      <span className="font-normal text-blue-300/70">· {item.debate_votes_for}/{item.debate_votes_against}</span>
                    )}
                  </span>
                )}
                {item.resolution_id && item.debate_status !== 'active' && (
                  <span className="inline-flex items-center gap-1 rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 border border-slate-600/30">
                    Debate
                    {(item.debate_votes_for > 0 || item.debate_votes_against > 0) && (
                      <span className="font-normal">· {item.debate_votes_for}/{item.debate_votes_against}</span>
                    )}
                  </span>
                )}
                {!item.resolution_id && item.debate_request_count > 0 && (
                  <span className="inline-flex items-center rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400/80 border border-amber-500/20">
                    {item.debate_request_count} {item.debate_request_count === 1 ? 'request' : 'requests'}
                  </span>
                )}
                {item.pvc_poll_id && (
                  <span className="inline-flex items-center rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/20">Vote</span>
                )}
                {item.impact_count > 0 && item.impact_score !== null && (
                  <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold border ${
                    item.impact_score >= 7 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                    item.impact_score >= 5 ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                    'bg-rose-500/10 text-rose-300 border-rose-500/20'
                  }`}>Impact {item.impact_score.toFixed(1)}</span>
                )}
                {lightTopics[`bill:${item.id}`] && <TopicChips chips={lightTopics[`bill:${item.id}`]} />}
                {item.current_stage && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${stageBadge(item.current_stage)}`}>
                    {item.current_stage}
                  </span>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
