'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import type { ChamberStatement, ChamberRelationship } from '@/components/chamber/ChamberGraph';

const ChamberGraph = dynamic(() => import('@/components/chamber/ChamberGraph'), { ssr: false });

// ── Constants ─────────────────────────────────────────────────────────────────

const SUBJECT_LABELS: Record<string, string> = {
  culture: 'Culture', economics: 'Economics', education: 'Education',
  environment: 'Environment & Energy', future: 'Future', health: 'Health',
  history: 'History', law: 'Law', media: 'Media',
  philosophy: 'Philosophy', politics: 'Politics', science: 'Science',
};
const SUBJECT_COLOURS: Record<string, string> = {
  culture: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
  economics: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  education: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  environment: 'bg-green-500/15 text-green-300 border-green-500/30',
  future: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  health: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  history: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  law: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  media: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  philosophy: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  politics: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  science: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
};
const STAT_BADGE: Record<string, string> = {
  resolution: 'bg-amber-400/20 text-amber-200 border-amber-500/40',
  claim:      'bg-slate-500/30 text-slate-200 border-slate-400/30',
  warrant:    'bg-violet-500/20 text-violet-200 border-violet-500/40',
  evidence:   'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
  rebuttal:   'bg-rose-500/20 text-rose-200 border-rose-500/40',
};
const STAT_LABEL: Record<string, string> = {
  resolution: 'Resolution', claim: 'Claim', warrant: 'Warrant',
  evidence: 'Evidence', rebuttal: 'Rebuttal',
};

// ── Types ─────────────────────────────────────────────────────────────────────

type Resolution = {
  id: string;
  stat_title: string;
  stat_description: string | null;
  subject_area: string;
  forum_visibility: string;
  image_path: string | null;
  created_at: string;
  creator_handle: string | null;
};

type FullStatement = ChamberStatement & {
  stat_description: string | null;
  created_at: string;
  creator_handle: string | null;
  agree_count: number;
  disagree_count: number;
};

type ChamberData = {
  resolution: Resolution;
  statements: FullStatement[];
  relationships: ChamberRelationship[];
};

type PublicDebate = {
  id: string;
  stat_title: string;
  subject_area: string;
  forum_visibility: string;
  child_count: number;
};

// ── Switchboard ───────────────────────────────────────────────────────────────

function Switchboard({
  currentId,
  onSelect,
  onClose,
}: {
  currentId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [debates, setDebates] = useState<PublicDebate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch('/api/debates/public')
      .then(r => r.json())
      .then(setDebates)
      .finally(() => setLoading(false));
  }, []);

  const filtered = debates.filter(d =>
    d.stat_title.toLowerCase().includes(filter.toLowerCase()) ||
    (SUBJECT_LABELS[d.subject_area] ?? d.subject_area).toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0c1322] shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-slate-100">Select a Debate</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter */}
        <div className="px-5 py-3 border-b border-slate-800">
          <input
            autoFocus
            type="text"
            placeholder="Filter debates…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-10 text-center text-slate-500 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-sm">No debates found</div>
          ) : (
            filtered.map(d => (
              <button
                key={d.id}
                onClick={() => { onSelect(d.id); onClose(); }}
                className={`w-full text-left px-5 py-4 border-b border-slate-800/60 hover:bg-slate-800/50 transition-colors flex items-start gap-3 ${d.id === currentId ? 'bg-blue-500/8' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-100 font-medium line-clamp-2 leading-snug">{d.stat_title}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold border ${SUBJECT_COLOURS[d.subject_area] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                      {SUBJECT_LABELS[d.subject_area] ?? d.subject_area}
                    </span>
                    {d.child_count > 0 && (
                      <span className="text-xs text-slate-500">{d.child_count} statement{d.child_count !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
                {d.id === currentId && (
                  <span className="text-xs text-blue-400 font-semibold mt-0.5 flex-shrink-0">Current</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  statement,
  onClose,
}: {
  statement: FullStatement | Resolution | null;
  onClose: () => void;
}) {
  if (!statement) return null;

  const fullStat = statement as FullStatement;
  const statType = 'stat_type' in fullStat ? fullStat.stat_type : 'resolution';
  const direction = 'stat_direction' in fullStat ? fullStat.stat_direction : null;
  const isResolution = statType === 'resolution';

  return (
    <div className="w-80 flex-shrink-0 flex flex-col border-l border-slate-800 bg-[#0c1322] overflow-y-auto">

      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-slate-800">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-400">Statement</p>
        <button onClick={onClose} className="rounded-lg p-1 text-slate-600 hover:text-slate-400 transition-colors">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-4 py-4 space-y-5">

        {/* Title */}
        <p className="text-base text-slate-100 font-semibold leading-snug">{statement.stat_title}</p>

        {/* Type & Direction */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Type & Direction</p>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded px-2.5 py-1 text-xs font-bold border ${STAT_BADGE[statType] ?? STAT_BADGE.claim}`}>
              {STAT_LABEL[statType] ?? statType}
            </span>
            {direction && (
              <span className={`rounded px-2.5 py-1 text-xs font-bold border ${
                direction === 'for'
                  ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
                  : 'bg-rose-500/20 text-rose-200 border-rose-500/40'
              }`}>
                {direction === 'for' ? 'For' : 'Against'}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {statement.stat_description && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Description</p>
            <p className="text-sm text-slate-300 leading-relaxed">{statement.stat_description}</p>
          </div>
        )}

        {/* Meta */}
        <div className="space-y-2">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Details</p>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            {new Date(statement.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          {statement.creator_handle && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              @{statement.creator_handle}
            </div>
          )}
        </div>

        {/* Voting — child statements only */}
        {!isResolution && (
          <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-3.5">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">Voting</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-2.5 text-center">
                <p className="text-xl font-bold text-emerald-400">{fullStat.agree_count}</p>
                <p className="text-xs text-slate-500 mt-0.5">Agree</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-2.5 text-center">
                <p className="text-xl font-bold text-rose-400">{fullStat.disagree_count}</p>
                <p className="text-xs text-slate-500 mt-0.5">Disagree</p>
              </div>
            </div>
            <button disabled className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 text-sm font-semibold text-slate-500 cursor-not-allowed opacity-50">
              Vote — coming soon
            </button>
          </div>
        )}

        {/* Debating Actions */}
        <div>
          <p className="text-xs text-amber-400 font-bold uppercase tracking-widest mb-3">Debating Actions</p>
          <div className="space-y-2">
            {[
              'Create a new Claim',
              'Create new Evidence',
              'Create a Warrant',
              'Rebut this statement',
              'Create a discussion point',
            ].map(action => (
              <div key={action} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/20 px-3 py-2.5 opacity-40">
                <span className="text-sm text-slate-400">{action}</span>
                <span className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-500">Soon</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── List Panel ────────────────────────────────────────────────────────────────

function ListPanel({
  resolution,
  statements,
  selectedId,
  onSelect,
}: {
  resolution: Resolution;
  statements: FullStatement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [filter, setFilter] = useState('');
  const allItems = [
    { id: resolution.id, stat_type: 'resolution', stat_title: resolution.stat_title, stat_direction: null },
    ...statements.map(s => ({ id: s.id, stat_type: s.stat_type, stat_title: s.stat_title, stat_direction: s.stat_direction })),
  ];

  const filtered = filter
    ? allItems.filter(s => s.stat_title.toLowerCase().includes(filter.toLowerCase()))
    : allItems;

  return (
    <div className="w-72 flex-shrink-0 flex flex-col border-r border-slate-800 bg-[#080d1a] overflow-hidden">
      {/* Filter input */}
      <div className="px-3 py-2.5 border-b border-slate-800">
        <input
          type="text"
          placeholder="Filter statements…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="w-full rounded-lg border border-slate-800 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-blue-500/50 focus:outline-none"
        />
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto] gap-1 px-3 py-2 border-b border-slate-800">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Statement</span>
        <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Type</span>
        <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Dir</span>
      </div>

      {/* Rows */}
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
            <span className="text-sm text-slate-200 truncate leading-snug min-w-0">
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

      {/* Footer count */}
      <div className="px-3 py-2 border-t border-slate-800">
        <span className="text-xs text-slate-600">
          {allItems.length} statement{allItems.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

// ── Control Bar ───────────────────────────────────────────────────────────────

function ControlBar({
  data,
  showList,
  showDetail,
  onToggleList,
  onToggleDetail,
  onOpenSwitchboard,
}: {
  data: ChamberData | null;
  showList: boolean;
  showDetail: boolean;
  onToggleList: () => void;
  onToggleDetail: () => void;
  onOpenSwitchboard: () => void;
}) {
  const res = data?.resolution;

  return (
    <div className="flex-shrink-0 border-b border-slate-800 bg-[#080d1a]">
      {/* Row 1: Chamber label + resolution title + panel buttons */}
      <div className="flex items-center gap-0 h-12 border-b border-slate-800/50">
        {/* Chamber label */}
        <div className="flex items-center gap-2 px-5 flex-shrink-0 border-r border-slate-800 h-full">
          <span className="text-sm font-bold text-slate-200 whitespace-nowrap">Debating Chamber</span>
        </div>

        {/* Resolution title */}
        <div className="flex-1 px-5 min-w-0">
          {res ? (
            <p className="text-sm text-slate-300 truncate">
              <span className="text-slate-500 mr-2">Resolution:</span>
              {res.stat_title}
            </p>
          ) : (
            <p className="text-sm text-slate-600 italic">No debate selected — click Switch Debate to begin</p>
          )}
        </div>

        {/* Panel toggles */}
        <div className="flex items-center gap-1.5 px-4 flex-shrink-0 border-l border-slate-800 h-full">
          <span className="text-xs text-slate-600 mr-1">Show:</span>
          {[
            { label: 'List',   active: showList,   action: onToggleList },
            { label: 'Detail', active: showDetail, action: onToggleDetail },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={btn.action}
              className={`rounded px-3 py-1.5 text-xs font-bold transition-colors ${
                btn.active
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              {btn.label}
            </button>
          ))}
          <button
            disabled
            className="rounded px-3 py-1.5 text-xs font-bold bg-slate-800 text-slate-600 cursor-not-allowed opacity-50"
          >
            Metrics
          </button>
          <button
            onClick={onOpenSwitchboard}
            className="ml-2 rounded px-3 py-1.5 text-xs font-bold bg-amber-600/80 text-amber-100 hover:bg-amber-500 transition-colors"
          >
            Switch Debate
          </button>
        </div>
      </div>

      {/* Row 2: Meta info */}
      {res && (
        <div className="flex items-center gap-4 px-5 h-9 text-xs text-slate-500">
          <span>
            Subject Area:{' '}
            <span className={`font-semibold ${SUBJECT_COLOURS[res.subject_area]?.split(' ')[1] ?? 'text-slate-300'}`}>
              {SUBJECT_LABELS[res.subject_area] ?? res.subject_area}
            </span>
          </span>
          <span className="text-slate-700">|</span>
          <span>
            Forum: <span className="text-slate-400">House Public Debates</span>
          </span>
          <span className="text-slate-700">|</span>
          <span>
            View: <span className="text-slate-400 capitalize">{res.forum_visibility}</span>
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main chamber (inner, uses search params) ───────────────────────────────────

function ChamberInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  useAuth();
  const resolutionParam = searchParams.get('resolution');

  const [data, setData] = useState<ChamberData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showList, setShowList] = useState(true);
  const [showDetail, setShowDetail] = useState(true);
  const [showSwitchboard, setShowSwitchboard] = useState(!resolutionParam);

  useEffect(() => {
    if (!resolutionParam) {
      setData(null);
      setSelectedId(null);
      setShowSwitchboard(true);
      return;
    }
    setLoading(true);
    setError('');
    setSelectedId(null);
    fetch(`/api/chamber/${resolutionParam}`)
      .then(r => {
        if (!r.ok) return r.json().then(d => Promise.reject(d.error ?? 'Not found'));
        return r.json();
      })
      .then((d: ChamberData) => setData(d))
      .catch(e => setError(typeof e === 'string' ? e : 'Could not load debate'))
      .finally(() => setLoading(false));
  }, [resolutionParam]);

  const handleNodeClick = useCallback((id: string) => {
    setSelectedId(id || null);
    if (id) setShowDetail(true);
  }, []);

  const handleSelectDebate = useCallback((id: string) => {
    router.push(`/chamber?resolution=${id}`);
  }, [router]);

  const selectedStatement: FullStatement | Resolution | null = (() => {
    if (!selectedId || !data) return null;
    if (selectedId === data.resolution.id) return data.resolution;
    return data.statements.find(s => s.id === selectedId) ?? null;
  })();

  return (
    <>
      <div className="fixed inset-0 top-16 z-40 bg-[#080d1a] flex flex-col overflow-hidden">

        <ControlBar
          data={data}
          showList={showList}
          showDetail={showDetail}
          onToggleList={() => setShowList(v => !v)}
          onToggleDetail={() => setShowDetail(v => !v)}
          onOpenSwitchboard={() => setShowSwitchboard(true)}
        />

        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* List panel */}
          {showList && data && (
            <ListPanel
              resolution={data.resolution}
              statements={data.statements}
              selectedId={selectedId}
              onSelect={handleNodeClick}
            />
          )}

          {/* Graph / main area */}
          <div className="flex-1 relative overflow-hidden min-w-0">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-slate-500 text-sm">Loading debate…</div>
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-red-400 text-sm mb-3">{error}</p>
                  <button onClick={() => setShowSwitchboard(true)} className="text-xs text-blue-400 hover:underline">
                    Choose a different debate →
                  </button>
                </div>
              </div>
            )}
            {!loading && !error && !data && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className="h-16 w-16 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <svg className="h-8 w-8 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                  </svg>
                </div>
                <p className="text-slate-400 text-sm">Select a debate to begin</p>
                <button
                  onClick={() => setShowSwitchboard(true)}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
                >
                  Open Switchboard
                </button>
              </div>
            )}
            {!loading && !error && data && (
              <ChamberGraph
                resolution={data.resolution}
                statements={data.statements}
                relationships={data.relationships}
                selectedId={selectedId}
                onNodeClick={handleNodeClick}
              />
            )}
          </div>

          {/* Detail panel */}
          {showDetail && selectedStatement && (
            <DetailPanel
              statement={selectedStatement}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      </div>

      {showSwitchboard && (
        <Switchboard
          currentId={resolutionParam}
          onSelect={handleSelectDebate}
          onClose={() => { if (data) setShowSwitchboard(false); }}
        />
      )}
    </>
  );
}

export default function ChamberPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 top-16 z-40 bg-[#080d1a] flex items-center justify-center">
        <p className="text-slate-500 text-sm">Loading chamber…</p>
      </div>
    }>
      <ChamberInner />
    </Suspense>
  );
}
