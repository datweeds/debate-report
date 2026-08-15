'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Resolution, FullStatement } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

type ArgItem = {
  claim: string; claim_desc: string; claim_id?: string | null;
  evidence: string; evidence_desc: string; evidence_id?: string | null;
  warrant: string; warrant_desc: string; warrant_id?: string | null;
  strength: number; strength_label: string;
  rebuts?: string;
};

type Results = { for: ArgItem[]; against: ArgItem[]; rebuttals: ArgItem[] };
type ArgSession = { id: string; results: Results; created_at: string };

type Props = {
  statement: FullStatement | Resolution;
  resolution: Resolution;
  onClose: () => void;
  onStatementsCreated: () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const STRENGTH_COLOUR = (n: number) =>
  n >= 9 ? 'text-emerald-300' : n >= 7 ? 'text-blue-300' : n >= 4 ? 'text-amber-300' : 'text-slate-500';

function StrengthBar({ value }: { value: number }) {
  const filled = Math.round(value / 2); // 1-5 pips
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(i => (
        <div key={i} className={`h-1.5 w-4 rounded-full ${i <= filled ? 'bg-blue-400' : 'bg-slate-700'}`} />
      ))}
      <span className={`text-[10px] font-bold ml-1 ${STRENGTH_COLOUR(value)}`}>
        {value}/10 {value >= 9 ? 'Very Strong' : value >= 7 ? 'Strong' : value >= 4 ? 'Moderate' : 'Weak'}
      </span>
    </div>
  );
}

// ── Pin Panel ─────────────────────────────────────────────────────────────────

function PinPanel({ item, claimNumber, rebuttals, onClose }: {
  item: ArgItem;
  claimNumber?: number;
  rebuttals: ArgItem[];
  onClose: () => void;
}) {
  const matchingRebuttals = claimNumber !== undefined
    ? rebuttals.filter(r => r.rebuts === `Claim ${claimNumber}`)
    : [];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#0c1322] border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60 sticky top-0 bg-[#0c1322] z-10">
          <div className="flex items-center gap-2">
            {claimNumber !== undefined
              ? <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Claim #{claimNumber}</span>
              : <span className="text-xs font-bold text-violet-400 uppercase tracking-widest">Rebuttal</span>
            }
            {item.rebuts && (
              <span className="text-xs text-violet-400 bg-violet-900/30 px-2 py-0.5 rounded">rebuts {item.rebuts}</span>
            )}
            <StrengthBar value={item.strength} />
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Claim */}
        <div className="px-6 py-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Claim</p>
          <p className="text-base font-semibold text-slate-100 leading-relaxed mb-3">{item.claim}</p>
          <p className="text-sm text-slate-400 leading-relaxed">{item.claim_desc}</p>
        </div>

        {/* Evidence */}
        <div className="px-6 py-5 border-t border-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-2">Evidence</p>
          <p className="text-sm font-semibold text-slate-200 leading-relaxed mb-2">{item.evidence}</p>
          <p className="text-sm text-slate-400 leading-relaxed">{item.evidence_desc}</p>
        </div>

        {/* Warrant */}
        <div className="px-6 py-5 border-t border-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-2">Warrant</p>
          <p className="text-sm font-semibold text-slate-200 leading-relaxed mb-2">{item.warrant}</p>
          <p className="text-sm text-slate-400 leading-relaxed">{item.warrant_desc}</p>
        </div>

        {/* Matching rebuttals */}
        {matchingRebuttals.map((r, i) => (
          <div key={i} className="px-6 py-5 border-t border-violet-800/40 bg-violet-950/20">
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-2">Rebuttal to this claim</p>
            <p className="text-sm font-semibold text-slate-200 leading-relaxed mb-2">{r.claim}</p>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">{r.claim_desc}</p>
            {r.evidence && (
              <>
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-1">Evidence</p>
                <p className="text-sm text-slate-300 leading-relaxed mb-1">{r.evidence}</p>
                <p className="text-sm text-slate-400 leading-relaxed mb-3">{r.evidence_desc}</p>
              </>
            )}
            {r.warrant && (
              <>
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-1">Warrant</p>
                <p className="text-sm text-slate-300 leading-relaxed mb-1">{r.warrant}</p>
                <p className="text-sm text-slate-400 leading-relaxed">{r.warrant_desc}</p>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Argument Card ─────────────────────────────────────────────────────────────

function ArgCard({
  item, group, index, claimNumber, selected, onToggle, creating, onPin,
}: {
  item: ArgItem;
  group: 'for' | 'against' | 'rebuttal';
  index: number;
  claimNumber?: number;
  selected: Set<string>;
  onToggle: (key: string) => void;
  creating: boolean;
  onPin: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const claimKey    = `${group}-${index}-claim`;
  const evidenceKey = `${group}-${index}-evidence`;
  const warrantKey  = `${group}-${index}-warrant`;

  const claimCreated    = !!item.claim_id;
  const evidenceCreated = !!item.evidence_id;
  const warrantCreated  = !!item.warrant_id;
  const claimSelected   = selected.has(claimKey);

  const borderColour = group === 'for'
    ? 'border-emerald-700/40 hover:border-emerald-500/60'
    : group === 'against'
    ? 'border-rose-700/40 hover:border-rose-500/60'
    : 'border-violet-700/40 hover:border-violet-500/60';

  const headerColour = group === 'for' ? 'text-emerald-400' : group === 'against' ? 'text-rose-400' : 'text-violet-400';

  function CheckRow({
    itemKey, label, created, title, desc, depKey,
  }: {
    itemKey: string; label: string; created: boolean;
    title: string; desc: string; depKey?: string;
  }) {
    const isSelected = selected.has(itemKey);
    // Can select if: not already created, and if dep required, dep is selected or already created
    const depOk = !depKey || selected.has(depKey) || !!item.claim_id;

    return (
      <div className={`rounded-lg p-2.5 mb-2 border transition-colors ${
        created
          ? 'border-slate-700/30 bg-slate-800/20 opacity-60'
          : isSelected
          ? 'border-blue-500/40 bg-blue-500/8'
          : 'border-slate-700/40 bg-slate-800/30'
      }`}>
        <div className="flex items-start gap-2">
          {created ? (
            <span className="flex-shrink-0 mt-0.5 rounded-full bg-emerald-500/20 p-0.5">
              <svg className="h-3 w-3 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </span>
          ) : (
            <input
              type="checkbox"
              checked={isSelected}
              disabled={creating || (!depOk)}
              onChange={() => onToggle(itemKey)}
              className="flex-shrink-0 mt-0.5 accent-blue-500 cursor-pointer disabled:opacity-40"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
              {created && <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Added ✓</span>}
            </div>
            <p className={`text-xs font-semibold leading-snug ${created ? 'text-slate-500' : 'text-slate-200'}`}>{title}</p>
            {expanded && desc && (
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{desc}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border bg-[#0c1322] flex flex-col transition-colors ${borderColour}`}>
      {/* Card header: number + strength */}
      <div className={`px-3 pt-3 pb-2 flex items-center justify-between border-b border-slate-800/60`}>
        <div className="flex items-center gap-2 min-w-0">
          {claimNumber !== undefined && (
            <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${headerColour} bg-slate-800`}>
              #{claimNumber}
            </span>
          )}
          {item.rebuts && (
            <span className="flex-shrink-0 text-[10px] text-violet-400 bg-violet-900/30 px-1.5 py-0.5 rounded">
              rebuts {item.rebuts}
            </span>
          )}
          <StrengthBar value={item.strength} />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <button
            onClick={onPin}
            title="View full detail"
            className="text-[10px] text-slate-500 hover:text-fuchsia-300 transition-colors"
          >
            ⊞
          </button>
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            {expanded ? 'Less ↑' : 'More ↓'}
          </button>
        </div>
      </div>

      <div className="p-3 flex-1 flex flex-col gap-1.5">
        <CheckRow
          itemKey={claimKey} label="Claim" created={claimCreated}
          title={item.claim} desc={item.claim_desc}
        />
        <CheckRow
          itemKey={warrantKey} label="Warrant" created={warrantCreated}
          title={item.warrant} desc={item.warrant_desc}
          depKey={claimSelected || claimCreated ? undefined : claimKey}
        />
        <CheckRow
          itemKey={evidenceKey} label="Evidence" created={evidenceCreated}
          title={item.evidence} desc={item.evidence_desc}
          depKey={selected.has(warrantKey) || warrantCreated ? undefined : warrantKey}
        />
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({
  title, subtitle, colour, items, group, startNumber, selected, onToggle, creating, onPin,
}: {
  title: string; subtitle?: string; colour: string; items: ArgItem[];
  group: 'for' | 'against' | 'rebuttal';
  startNumber?: number;
  selected: Set<string>; onToggle: (k: string) => void; creating: boolean;
  onPin: (index: number) => void;
}) {
  if (!items.length) return null;
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 mb-3">
        <h3 className={`text-xs font-bold uppercase tracking-widest ${colour}`}>{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 italic">{subtitle}</p>}
      </div>
      <div className={`grid gap-3 ${
        group === 'rebuttal'
          ? 'grid-cols-1 sm:grid-cols-2'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
      }`}>
        {items.map((item, i) => (
          <ArgCard
            key={i} item={item} group={group} index={i}
            claimNumber={startNumber !== undefined ? startNumber + i : undefined}
            selected={selected} onToggle={onToggle} creating={creating}
            onPin={() => onPin(i)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function ArgueModal({ statement, resolution, onClose, onStatementsCreated }: Props) {
  const isResolution = statement.id === resolution.id;

  const [session,    setSession]    = useState<ArgSession | null>(null);
  const [quota,      setQuota]      = useState<{ quota: number; used: number; remaining: number } | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const [generating, setGenerating] = useState(false);
  const [genError,   setGenError]   = useState('');

  const [resExpanded,  setResExpanded]  = useState(false);
  const [stmtExpanded, setStmtExpanded] = useState(false);

  const [selected,  setSelected]  = useState<Set<string>>(new Set());
  const [creating,  setCreating]  = useState(false);
  const [createErr, setCreateErr] = useState('');
  const [pinned, setPinned] = useState<{ group: 'for' | 'against' | 'rebuttal'; index: number } | null>(null);

  const results: Results | null = session?.results ?? null;

  // Load latest session for this statement
  useEffect(() => {
    setLoadingSession(true);
    fetch(`/api/statements/${statement.id}/argue`)
      .then(r => r.json())
      .then(d => {
        setSession(d.session ?? null);
        setQuota({ quota: d.quota, used: d.used, remaining: d.remaining });
      })
      .catch(() => {})
      .finally(() => setLoadingSession(false));
  }, [statement.id]);

  const toggleItem = useCallback((key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Count selectable items (not yet created)
  const selectionCount = selected.size;

  async function generate() {
    setGenerating(true); setGenError('');
    try {
      const res = await fetch(`/api/statements/${statement.id}/argue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const d = await res.json();
      if (!res.ok) { setGenError(d.error ?? 'Generation failed'); return; }
      setSession(d.session);
      setQuota({ quota: d.quota, used: d.used, remaining: d.remaining });
      setSelected(new Set());
    } catch {
      setGenError('Network error');
    } finally {
      setGenerating(false);
    }
  }

  async function createSelected() {
    if (!session || selectionCount === 0) return;
    setCreating(true); setCreateErr('');
    try {
      const res = await fetch(`/api/statements/${statement.id}/argue/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, items: Array.from(selected) }),
      });
      const d = await res.json();
      if (!res.ok) { setCreateErr(d.error ?? 'Create failed'); return; }
      setSession(prev => prev ? { ...prev, results: d.results } : prev);
      setSelected(new Set());
      onStatementsCreated();
    } catch {
      setCreateErr('Network error');
    } finally {
      setCreating(false);
    }
  }

  const hasResults = results && (results.for.length > 0 || results.against.length > 0 || results.rebuttals.length > 0);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#080d1a]">

      {/* ── Header ── */}
      <div className="flex-shrink-0 border-b border-slate-800 bg-[#080d1a]">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2.5">
            <svg className="h-5 w-5 text-fuchsia-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
            </svg>
            <h2 className="text-base font-bold text-slate-100">Argument Assistant</h2>
            <button onClick={onClose} className="ml-1 rounded-lg px-3 py-1 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors">
              Close
            </button>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Context strip */}
        <div className="px-5 pb-3 flex flex-col sm:flex-row gap-3">
          {/* Resolution */}
          <div className="flex-1 rounded-xl border border-slate-700/50 bg-slate-800/30 px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-amber-400 mb-1">Resolution</p>
            <p className="text-sm font-semibold text-slate-100 leading-snug">{resolution.stat_title}</p>
            {resolution.stat_description && (
              <>
                <p className={`text-xs text-slate-400 mt-1.5 leading-relaxed ${!resExpanded ? 'line-clamp-2' : ''}`}>
                  {resolution.stat_description}
                </p>
                {resolution.stat_description.length > 120 && (
                  <button onClick={() => setResExpanded(v => !v)} className="text-[10px] text-blue-400 hover:text-blue-300 mt-0.5">
                    {resExpanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Statement (only if not viewing the resolution itself) */}
          {!isResolution && (
            <div className="flex-1 rounded-xl border border-blue-700/40 bg-blue-500/5 px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-blue-400 mb-1">Statement</p>
              <p className="text-sm font-semibold text-slate-100 leading-snug">{statement.stat_title}</p>
              {'stat_description' in statement && statement.stat_description && (
                <>
                  <p className={`text-xs text-slate-400 mt-1.5 leading-relaxed ${!stmtExpanded ? 'line-clamp-2' : ''}`}>
                    {statement.stat_description}
                  </p>
                  {statement.stat_description.length > 120 && (
                    <button onClick={() => setStmtExpanded(v => !v)} className="text-[10px] text-blue-400 hover:text-blue-300 mt-0.5">
                      {stmtExpanded ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="px-5 pb-3 flex items-center gap-4 flex-wrap">
          <button
            onClick={generate}
            disabled={generating || loadingSession || (quota?.remaining === 0)}
            className="flex items-center gap-2 rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-500 disabled:opacity-40 transition-colors"
          >
            {generating ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4}/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Researching…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                </svg>
                {hasResults ? 'Re-research Arguments' : 'Research Arguments'}
              </>
            )}
          </button>

          {quota && (
            <p className="text-xs text-slate-500">
              <span className={quota.remaining > 0 ? 'text-slate-300' : 'text-red-400'}>
                {quota.remaining} of {quota.quota}
              </span>{' '}
              uses remaining this month
            </p>
          )}

          {genError && <p className="text-xs text-red-400">{genError}</p>}
        </div>
      </div>

      {/* ── Results area ── */}
      <div className="flex-1 overflow-y-auto px-5 py-5">

        {loadingSession && (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-slate-500">Loading…</p>
          </div>
        )}

        {generating && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <svg className="h-8 w-8 text-fuchsia-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4}/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p className="text-sm font-semibold text-slate-300 text-center max-w-lg">debate.report AI agents are researching potential arguments for you. This should take about 30 seconds, sometimes a bit longer.</p>
            <p className="text-xs text-slate-400 text-center max-w-lg">Once provided you will be able to review and select any arguments you want to carry forward to the actual debate. If you wish to, you can come back to this Assistant later and carry forward additional arguments. Once carried forward to the debate, you can edit the arguments in the Chamber.</p>
          </div>
        )}

        {!generating && !loadingSession && !hasResults && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <svg className="h-12 w-12 text-slate-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
            </svg>
            <p className="text-sm text-slate-500">Click "Research Arguments" to generate AI-powered arguments</p>
            <p className="text-xs text-slate-600">Arguments are grounded in evidence and structured as Claim → Evidence → Warrant</p>
          </div>
        )}

        {!generating && hasResults && results && (
          <div className="space-y-8">
            {/* For + Against row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {results.for.length > 0 && (
                <Section
                  title={`For the statement (${results.for.length})`}
                  colour="text-emerald-400"
                  items={results.for} group="for" startNumber={1}
                  selected={selected} onToggle={toggleItem} creating={creating}
                  onPin={i => setPinned({ group: 'for', index: i })}
                />
              )}
              {results.against.length > 0 && (
                <Section
                  title={`Against the statement (${results.against.length})`}
                  colour="text-rose-400"
                  items={results.against} group="against" startNumber={results.for.length + 1}
                  selected={selected} onToggle={toggleItem} creating={creating}
                  onPin={i => setPinned({ group: 'against', index: i })}
                />
              )}
            </div>

            {/* Rebuttals */}
            {results.rebuttals.length > 0 && (
              <Section
                title={`Rebuttals (${results.rebuttals.length})`}
                subtitle="Counter-arguments that challenge the strongest Against claims"
                colour="text-violet-400"
                items={results.rebuttals} group="rebuttal"
                selected={selected} onToggle={toggleItem} creating={creating}
                onPin={i => setPinned({ group: 'rebuttal', index: i })}
              />
            )}

            {/* Session info */}
            {session && (
              <p className="text-[10px] text-slate-700 text-right">
                Generated {new Date(session.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {' · '}Results saved — you can close and return later
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Create footer ── */}
      {hasResults && (
        <div className="flex-shrink-0 border-t border-slate-800 bg-[#080d1a] px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500">
              {selectionCount === 0
                ? 'Select items above to add them to the debate'
                : `${selectionCount} item${selectionCount !== 1 ? 's' : ''} selected`}
            </p>
            {createErr && <p className="text-xs text-red-400">{createErr}</p>}
          </div>

          <button
            onClick={createSelected}
            disabled={selectionCount === 0 || creating}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors"
          >
            {creating ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4}/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Creating…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create{selectionCount > 0 ? ` ${selectionCount} item${selectionCount !== 1 ? 's' : ''}` : ''} in Debate
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Pin detail panel ── */}
      {pinned && results && (() => {
        const arr = pinned.group === 'for' ? results.for : pinned.group === 'against' ? results.against : results.rebuttals;
        const item = arr[pinned.index];
        const claimNumber = pinned.group === 'for'
          ? pinned.index + 1
          : pinned.group === 'against'
          ? results.for.length + pinned.index + 1
          : undefined;
        return item ? (
          <PinPanel
            item={item}
            claimNumber={claimNumber}
            rebuttals={results.rebuttals}
            onClose={() => setPinned(null)}
          />
        ) : null;
      })()}
    </div>
  );
}
