'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

export type Msp = {
  person_id: number;
  parliamentary_name: string;
  preferred_name: string | null;
  photo_url: string | null;
  is_current: boolean;
  party_name: string | null;
  party_abbr: string | null;
  bills_sponsored: number;
  constituency_name: string | null;
};

const PARTY_COLOURS: Record<string, string> = {
  'conservative':      'bg-blue-500/15 text-blue-300 border-blue-500/30',
  'labour':            'bg-rose-500/15 text-rose-300 border-rose-500/30',
  'liberal democrat':  'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'scottish national': 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  'scottish green':    'bg-green-500/15 text-green-300 border-green-500/30',
  'alba':              'bg-sky-500/15 text-sky-300 border-sky-500/30',
  'independent':       'bg-slate-500/15 text-slate-300 border-slate-500/30',
  'reform':            'bg-teal-500/15 text-teal-300 border-teal-500/30',
};

function partyBadge(name: string | null) {
  if (!name) return 'bg-slate-700/30 text-slate-400 border-slate-600/20';
  const key = name.toLowerCase();
  for (const [k, v] of Object.entries(PARTY_COLOURS)) {
    if (key.includes(k)) return v;
  }
  return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
}

export function displayName(msp: Pick<Msp, 'preferred_name' | 'parliamentary_name'>) {
  if (msp.preferred_name && msp.parliamentary_name.includes(',')) {
    const surname = msp.parliamentary_name.split(',')[0].trim();
    return `${msp.preferred_name} ${surname}`;
  }
  return msp.parliamentary_name;
}

export default function MspList({
  msps, parties, constituencies,
}: {
  msps: Msp[];
  parties: string[];
  constituencies: string[];
}) {
  const [search, setSearch]               = useState('');
  const [partyFilter, setParty]           = useState('');
  const [constituencyFilter, setConst]    = useState('');
  const [showAll, setShowAll]             = useState(false);

  const currentCount = msps.filter(m => m.is_current).length;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return msps.filter(m => {
      if (!showAll && !m.is_current) return false;
      if (partyFilter && m.party_name !== partyFilter) return false;
      if (constituencyFilter && m.constituency_name !== constituencyFilter) return false;
      if (!q) return true;
      return (
        displayName(m).toLowerCase().includes(q) ||
        (m.party_name ?? '').toLowerCase().includes(q) ||
        (m.constituency_name ?? '').toLowerCase().includes(q)
      );
    });
  }, [msps, search, partyFilter, constituencyFilter, showAll]);

  const hasFilters = !!(search || partyFilter || constituencyFilter);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Search MSPs…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={partyFilter}
          onChange={e => setParty(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 focus:border-blue-500 focus:outline-none"
        >
          <option value="">All parties</option>
          {parties.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {constituencies.length > 0 && (
          <select
            value={constituencyFilter}
            onChange={e => setConst(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 focus:border-blue-500 focus:outline-none"
          >
            <option value="">All constituencies</option>
            {constituencies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <button
          onClick={() => setShowAll(v => !v)}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${showAll ? 'bg-blue-600/20 border-blue-500/40 text-blue-300' : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'}`}
        >
          {showAll ? 'All sessions' : 'Current only'}
        </button>
      </div>

      <p className="text-xs text-slate-600">
        Showing {filtered.length} {showAll ? `of ${msps.length} total` : `current MSPs (${currentCount})`}
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setParty(''); setConst(''); }}
            className="ml-2 text-blue-500 hover:text-blue-400 underline underline-offset-2"
          >
            Clear
          </button>
        )}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(m => (
          <Link
            key={m.person_id}
            href={`/scotparl/msps/${m.person_id}`}
            className="card-dr p-4 flex items-center gap-3 hover:border-blue-700/40 transition-colors"
          >
            {m.photo_url ? (
              <img src={m.photo_url} alt="" className="h-11 w-11 rounded-full object-cover flex-shrink-0 bg-slate-700" />
            ) : (
              <div className="h-11 w-11 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center">
                <span className="text-lg text-slate-500">{displayName(m)[0]}</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-100 truncate">{displayName(m)}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {m.party_name && (
                  <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold border ${partyBadge(m.party_name)}`}>
                    {m.party_abbr ?? m.party_name}
                  </span>
                )}
                {!m.is_current && <span className="text-xs text-slate-600">Former</span>}
              </div>
              {m.constituency_name && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">{m.constituency_name}</p>
              )}
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-10 text-center text-slate-500 text-sm">No MSPs match your filters.</div>
        )}
      </div>
    </div>
  );
}
