'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Analysis = {
  id: number;
  topic_id: number;
  topic_name: string;
  status: string;
  overall_score: number | null;
};

type Topic = { id: number; name: string };

type Props = {
  entityType: 'bill' | 'proposal';
  entityId: number;
  impactHref: string;
  canManage: boolean;
  isLoggedIn: boolean;
};

function ScoreChip({ score }: { score: number }) {
  const cls = score >= 7
    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
    : score >= 5
    ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
    : 'bg-rose-500/10 text-rose-300 border-rose-500/20';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {score.toFixed(1)}/10
    </span>
  );
}

export default function ImpactTrigger({ entityType, entityId, impactHref, canManage, isLoggedIn }: Props) {
  const router = useRouter();
  const [analyses, setAnalyses]   = useState<Analysis[]>([]);
  const [topics,   setTopics]     = useState<Topic[]>([]);
  const [running,  setRunning]    = useState(false);
  const [error,    setError]      = useState('');
  const [selTopic, setSelTopic]   = useState<number>(0);

  useEffect(() => {
    fetch(`/api/scotparl/nsp/impact?entity_type=${entityType}&entity_id=${entityId}`)
      .then(r => r.ok ? r.json() : { analyses: [] })
      .then(d => setAnalyses(d.analyses ?? []));
    if (canManage) {
      fetch('/api/scotparl/nsp')
        .then(r => r.ok ? r.json() : { topics: [] })
        .then(d => {
          const ts = (d.topics ?? []).filter((t: { current_set: unknown }) => t.current_set);
          setTopics(ts);
          if (ts.length) setSelTopic(ts[0].id);
        });
    }
  }, [entityType, entityId, canManage]);

  async function run() {
    if (!selTopic) return;
    setRunning(true); setError('');
    const res = await fetch('/api/scotparl/nsp/impact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: entityType, entity_id: entityId, topic_id: selTopic }),
    });
    setRunning(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Analysis failed');
    } else {
      router.refresh();
    }
  }

  const hasAnalyses = analyses.length > 0;

  if (!hasAnalyses && !canManage) return null;

  return (
    <div className="card-dr px-5 py-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">Society Impact Analysis</p>
        {hasAnalyses && isLoggedIn && (
          <Link
            href={impactHref}
            className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            View full report →
          </Link>
        )}
        {hasAnalyses && !isLoggedIn && (
          <span className="text-xs text-slate-500">
            <Link href="/register" className="text-blue-400 hover:underline">Register</Link> to view the full report
          </span>
        )}
      </div>

      {/* Existing analyses summary */}
      {hasAnalyses && (
        <div className="flex flex-wrap gap-2">
          {analyses.map(a => (
            <div key={a.id} className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">{a.topic_name}:</span>
              {a.status === 'done' && a.overall_score ? (
                <ScoreChip score={a.overall_score} />
              ) : a.status === 'running' ? (
                <span className="text-xs text-slate-500 animate-pulse">Running…</span>
              ) : (
                <span className="text-xs text-slate-600">{a.status}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Trigger section (canManage only) */}
      {canManage && topics.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/60">
          <select
            value={selTopic}
            onChange={e => setSelTopic(parseInt(e.target.value, 10))}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-violet-500"
          >
            {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button
            onClick={run}
            disabled={running || !selTopic}
            className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
          >
            {running ? (
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Analysing…
              </span>
            ) : analyses.find(a => a.topic_id === selTopic) ? 'Re-run' : 'Run Analysis'}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-rose-400">{error}</p>}
    </div>
  );
}
