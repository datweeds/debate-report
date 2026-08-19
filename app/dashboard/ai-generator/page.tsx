'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Debate = { id: string; stat_title: string; stat_status: string };
type Statement = { id: string; stat_type: string; stat_title: string; stat_direction: string | null };

type ArgItem = {
  claim?: string; claim_desc?: string; claim_id?: string | null;
  evidence?: string; evidence_desc?: string; evidence_id?: string | null;
  warrant?: string; warrant_desc?: string; warrant_id?: string | null;
  rebuts?: string;
  strength?: number; strength_label?: string;
};

type ArgResults = { for: ArgItem[]; against: ArgItem[]; rebuttals: ArgItem[] };
type QuotaInfo = { quota: number; used: number; remaining: number };
type Session = { id: string; results: ArgResults };

function StrengthBar({ strength }: { strength?: number }) {
  if (!strength) return null;
  const pct = (strength / 10) * 100;
  const colour = strength >= 7 ? 'bg-emerald-500' : strength >= 4 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 rounded-full bg-slate-700">
        <div className={`h-full rounded-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-slate-500 w-16 text-right">{strength}/10 · {strength >= 7 ? 'Strong' : strength >= 4 ? 'Moderate' : 'Weak'}</span>
    </div>
  );
}

function ArgCard({
  item, groupKey, index, selected, onToggle, alreadyAdded,
}: {
  item: ArgItem;
  groupKey: 'for' | 'against' | 'rebuttal';
  index: number;
  selected: Set<string>;
  onToggle: (key: string) => void;
  alreadyAdded: (key: string) => boolean;
}) {
  const claimKey   = `${groupKey}-${index}-claim`;
  const evidenceKey = `${groupKey}-${index}-evidence`;
  const warrantKey  = `${groupKey}-${index}-warrant`;

  const accent = groupKey === 'for' ? 'border-emerald-800/40 bg-emerald-500/5' :
                 groupKey === 'against' ? 'border-rose-800/40 bg-rose-500/5' :
                 'border-blue-800/40 bg-blue-500/5';
  const dot = groupKey === 'for' ? 'bg-emerald-500' : groupKey === 'against' ? 'bg-rose-500' : 'bg-blue-500';

  function Row({ label, text, desc, k }: { label: string; text?: string; desc?: string; k: string }) {
    if (!text) return null;
    const done = alreadyAdded(k);
    return (
      <label className={`flex items-start gap-3 py-2 px-3 rounded-lg cursor-pointer transition-colors ${
        done ? 'opacity-40 cursor-not-allowed' : selected.has(k) ? 'bg-slate-700/40' : 'hover:bg-slate-700/20'
      }`}>
        <input
          type="checkbox"
          disabled={done}
          checked={selected.has(k) || done}
          onChange={() => !done && onToggle(k)}
          className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 accent-blue-500 flex-shrink-0"
        />
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1.5">{label}</span>
          {done && <span className="text-[10px] text-emerald-500 font-medium">Added ✓</span>}
          <p className="text-sm text-slate-200 leading-snug mt-0.5">{text}</p>
          {desc && <p className="text-xs text-slate-500 leading-relaxed mt-1">{desc}</p>}
        </div>
      </label>
    );
  }

  return (
    <div className={`rounded-xl border ${accent} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dot}`} />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            {groupKey === 'for' ? `For · Argument ${index + 1}` :
             groupKey === 'against' ? `Against · Argument ${index + 1}` :
             `Rebuttal ${index + 1}${item.rebuts ? ` (rebuts ${item.rebuts})` : ''}`}
          </span>
          {item.strength !== undefined && <StrengthBar strength={item.strength} />}
        </div>
      </div>
      <div className="divide-y divide-slate-800/40">
        <Row label="Claim"    text={item.claim}    desc={item.claim_desc}    k={claimKey} />
        <Row label="Evidence" text={item.evidence} desc={item.evidence_desc} k={evidenceKey} />
        <Row label="Warrant"  text={item.warrant}  desc={item.warrant_desc}  k={warrantKey} />
      </div>
    </div>
  );
}

export default function AiGeneratorPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login?next=/dashboard/ai-generator');
    if (!loading && user && user.tier !== 'moderator' && !user.isSysAdmin) router.push('/dashboard');
  }, [loading, user, router]);

  const [debates,     setDebates]     = useState<Debate[]>([]);
  const [debateId,    setDebateId]    = useState('');
  const [statements,  setStatements]  = useState<Statement[]>([]);
  const [stmtId,      setStmtId]      = useState('');

  const [quota,       setQuota]       = useState<QuotaInfo | null>(null);
  const [session,     setSession]     = useState<Session | null>(null);
  const [generating,  setGenerating]  = useState(false);
  const [genError,    setGenError]    = useState('');

  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [adding,      setAdding]      = useState(false);
  const [addError,    setAddError]    = useState('');
  const [addSuccess,  setAddSuccess]  = useState('');

  // Load debates
  useEffect(() => {
    fetch('/api/debates')
      .then(r => r.ok ? r.json() : [])
      .then(setDebates)
      .catch(() => {});
  }, []);

  // Load statements when debate changes
  useEffect(() => {
    if (!debateId) { setStatements([]); setStmtId(''); setSession(null); setQuota(null); return; }
    fetch(`/api/chamber/${debateId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        const all: Statement[] = [
          { id: d.resolution.id, stat_type: 'resolution', stat_title: d.resolution.stat_title, stat_direction: null },
          ...d.statements.filter((s: Statement) => !s.stat_title?.startsWith('[')),
        ];
        setStatements(all);
        setStmtId(d.resolution.id); // default to resolution
      })
      .catch(() => {});
  }, [debateId]);

  // Load existing session + quota when statement changes
  const loadSession = useCallback(async (id: string) => {
    if (!id) { setSession(null); setQuota(null); return; }
    try {
      const r = await fetch(`/api/statements/${id}/argue`);
      if (!r.ok) return;
      const d = await r.json();
      setQuota({ quota: d.quota, used: d.used, remaining: d.remaining });
      if (d.session) { setSession(d.session); setSelected(new Set()); }
      else setSession(null);
    } catch {}
  }, []);

  useEffect(() => { loadSession(stmtId); }, [stmtId, loadSession]);

  async function generate() {
    if (!stmtId) return;
    setGenerating(true); setGenError(''); setAddError(''); setAddSuccess('');
    try {
      const r = await fetch(`/api/statements/${stmtId}/argue`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) { setGenError(d.error ?? 'Generation failed'); return; }
      setSession(d.session);
      setQuota({ quota: d.quota, used: d.used, remaining: d.remaining });
      setSelected(new Set());
    } catch {
      setGenError('Network error. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  function toggleKey(k: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }

  function alreadyAdded(k: string): boolean {
    if (!session) return false;
    const parts = k.split('-');
    const group = parts[0] as 'for' | 'against' | 'rebuttal';
    const idx = parseInt(parts[1]);
    const part = parts[2] as 'claim' | 'evidence' | 'warrant';
    const arr = group === 'for' ? session.results.for :
                group === 'against' ? session.results.against :
                session.results.rebuttals;
    return !!(arr[idx] as Record<string, unknown>)?.[`${part}_id`];
  }

  function selectAll() {
    if (!session) return;
    const keys: string[] = [];
    (['for', 'against', 'rebuttal'] as const).forEach(g => {
      const arr = g === 'for' ? session.results.for : g === 'against' ? session.results.against : session.results.rebuttals;
      arr.forEach((item, i) => {
        if (item.claim    && !alreadyAdded(`${g}-${i}-claim`))    keys.push(`${g}-${i}-claim`);
        if (item.evidence && !alreadyAdded(`${g}-${i}-evidence`)) keys.push(`${g}-${i}-evidence`);
        if (item.warrant  && !alreadyAdded(`${g}-${i}-warrant`))  keys.push(`${g}-${i}-warrant`);
      });
    });
    setSelected(new Set(keys));
  }

  async function addSelected() {
    if (!stmtId || !session || selected.size === 0) return;
    setAdding(true); setAddError(''); setAddSuccess('');
    try {
      const r = await fetch(`/api/statements/${stmtId}/argue/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, items: Array.from(selected) }),
      });
      const d = await r.json();
      if (!r.ok) { setAddError(d.error ?? 'Failed to add'); return; }
      setSession({ ...session, results: d.results });
      setSelected(new Set());
      setAddSuccess(`Added ${selected.size} item${selected.size !== 1 ? 's' : ''} to the debate.`);
    } catch {
      setAddError('Network error. Please try again.');
    } finally {
      setAdding(false);
    }
  }

  if (loading || !user) return null;

  const results = session?.results;
  const allGroups: { key: 'for' | 'against' | 'rebuttal'; label: string; items: ArgItem[] }[] = results ? [
    { key: 'for',      label: 'For',      items: results.for },
    { key: 'against',  label: 'Against',  items: results.against },
    { key: 'rebuttal', label: 'Rebuttals', items: results.rebuttals },
  ] : [];

  const anySelected = selected.size > 0;
  const currentStmt = statements.find(s => s.id === stmtId);

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
          <Link href="/dashboard" className="hover:text-slate-300 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-slate-300">AI Argument Generator</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100">AI Argument Generator</h1>
        <p className="text-sm text-slate-500 mt-1">Generate structured For / Against arguments for any debate statement using Claude AI.</p>
      </div>

      {/* Step 1: Pick debate + statement */}
      <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-5 mb-5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">1 · Select target</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Debate</label>
            <select
              value={debateId}
              onChange={e => { setDebateId(e.target.value); setSession(null); setSelected(new Set()); setGenError(''); setAddError(''); setAddSuccess(''); }}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="">— choose a debate —</option>
              {debates.map(d => (
                <option key={d.id} value={d.id}>
                  {d.stat_title.length > 70 ? d.stat_title.slice(0, 70) + '…' : d.stat_title}
                  {d.stat_status === 'closed' ? ' [closed]' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Statement to analyse</label>
            <select
              value={stmtId}
              onChange={e => { setStmtId(e.target.value); setSession(null); setSelected(new Set()); setGenError(''); setAddError(''); setAddSuccess(''); }}
              disabled={!debateId || statements.length === 0}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            >
              <option value="">— choose a statement —</option>
              {statements.map(s => (
                <option key={s.id} value={s.id}>
                  [{s.stat_type}{s.stat_direction ? ` · ${s.stat_direction}` : ''}] {s.stat_title.length > 55 ? s.stat_title.slice(0, 55) + '…' : s.stat_title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {currentStmt && (
          <p className="text-xs text-slate-500 leading-relaxed">
            Analysing: <span className="text-slate-300">{currentStmt.stat_title}</span>
          </p>
        )}
      </div>

      {/* Step 2: Generate */}
      {stmtId && (
        <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-5 mb-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">2 · Generate arguments</p>
              {quota && (
                <p className="text-xs text-slate-500">
                  {quota.remaining} generation{quota.remaining !== 1 ? 's' : ''} remaining this month
                  <span className="text-slate-700 mx-1">·</span>
                  {quota.used}/{quota.quota} used
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {session && (
                <span className="text-xs text-slate-500">Previous results loaded</span>
              )}
              <button
                onClick={generate}
                disabled={generating || !stmtId || (quota?.remaining === 0)}
                className="flex items-center gap-2 rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-500 disabled:opacity-50 transition-colors"
              >
                {generating ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating…
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                    </svg>
                    {session ? 'Regenerate' : 'Generate'}
                  </>
                )}
              </button>
            </div>
          </div>

          {quota?.remaining === 0 && (
            <p className="text-xs text-amber-400 mt-3">Monthly quota reached. Resets at the start of next month.</p>
          )}
          {genError && <p className="text-sm text-rose-400 mt-3">{genError}</p>}
        </div>
      )}

      {/* Step 3: Results */}
      {results && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">3 · Select items to add</p>
            <button onClick={selectAll} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              Select all available
            </button>
          </div>

          {allGroups.map(({ key, label, items }) => items.length > 0 && (
            <div key={key}>
              <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${
                key === 'for' ? 'text-emerald-400' : key === 'against' ? 'text-rose-400' : 'text-blue-400'
              }`}>{label}</p>
              <div className="space-y-3">
                {items.map((item, i) => (
                  <ArgCard
                    key={i}
                    item={item}
                    groupKey={key}
                    index={i}
                    selected={selected}
                    onToggle={toggleKey}
                    alreadyAdded={alreadyAdded}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Add to debate */}
          <div className="sticky bottom-4 rounded-2xl border border-blue-800/30 bg-[#080d1a]/95 backdrop-blur-sm p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-200">
                {anySelected ? `${selected.size} item${selected.size !== 1 ? 's' : ''} selected` : 'No items selected'}
              </p>
              {addSuccess && <p className="text-xs text-emerald-400 mt-0.5">{addSuccess}</p>}
              {addError   && <p className="text-xs text-rose-400 mt-0.5">{addError}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href={`/chamber?resolution=${debateId}`}
                target="_blank"
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
              >
                View debate
              </Link>
              <button
                onClick={addSelected}
                disabled={!anySelected || adding}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {adding ? 'Adding…' : 'Add to debate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
