'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ImpactScore = {
  principle_id: number;
  principle_title: string;
  score: number;
  score_label: string;
  impacts: { section: string; description: string }[];
};

type Report = {
  summary: string;
  scores: ImpactScore[];
};

type Analysis = {
  id: number;
  topic_id: number;
  topic_name: string;
  status: string;
  overall_score: number | null;
  report: Report | null;
  notes: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type Props = {
  entityType: 'bill' | 'proposal';
  entityId: number;
  entityTitle: string;
  analyses: Analysis[];
  activeAnalysis: Analysis | null;
  topics: { id: number; name: string }[];
  canManage: boolean;
  backHref: string;
};

function scoreColor(score: number): string {
  if (score <= 2)  return 'bg-rose-600';
  if (score <= 4)  return 'bg-orange-500';
  if (score === 5) return 'bg-slate-500';
  if (score <= 7)  return 'bg-emerald-500/70';
  return 'bg-emerald-500';
}

function scoreTextColor(score: number): string {
  if (score <= 2)  return 'text-rose-400';
  if (score <= 4)  return 'text-orange-400';
  if (score === 5) return 'text-slate-400';
  if (score <= 7)  return 'text-emerald-400/80';
  return 'text-emerald-400';
}

function ScoreBadge({ score, label }: { score: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold text-white ${scoreColor(score)}`}>
        {score}
      </span>
      <span className={`text-xs font-medium ${scoreTextColor(score)}`}>{label}</span>
    </div>
  );
}

function OverallBadge({ score }: { score: number }) {
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold border ${
      score >= 7 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
      score >= 5 ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
      'bg-rose-500/10 text-rose-300 border-rose-500/20'
    }`}>
      {score.toFixed(1)}/10
    </div>
  );
}

export default function ImpactReport({
  entityType, entityId, entityTitle, analyses, activeAnalysis, topics, canManage, backHref,
}: Props) {
  const router = useRouter();
  const [running, setRunning]       = useState(false);
  const [error, setError]           = useState('');
  const [selectedTopic, setTopic]   = useState<number>(activeAnalysis?.topic_id ?? topics[0]?.id ?? 0);
  const [filterPrinciple, setFilter] = useState<number | 'all'>('all');
  const [editingNotes, setEditNotes] = useState(false);
  const [notesText, setNotesText]   = useState(activeAnalysis?.notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);

  const current = analyses.find(a => a.topic_id === selectedTopic) ?? null;

  async function runAnalysis() {
    if (!selectedTopic) { setError('Select a topic first'); return; }
    setRunning(true); setError('');
    const res = await fetch('/api/scotparl/nsp/impact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_type: entityType,
        entity_id:   entityId,
        topic_id:    selectedTopic,
        notes:       current?.notes ?? null,
      }),
    });
    setRunning(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Analysis failed');
      return;
    }
    router.refresh();
  }

  async function saveNotes() {
    if (!current) return;
    setSavingNotes(true);
    await fetch(`/api/scotparl/nsp/impact/${current.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notesText }),
    });
    setSavingNotes(false);
    setEditNotes(false);
    router.refresh();
  }

  const scores = current?.report?.scores ?? [];
  const filtered = filterPrinciple === 'all' ? scores : scores.filter(s => s.principle_id === filterPrinciple);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-dr px-6 py-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-400 mb-1">Society Impact Analysis</p>
            <h1 className="text-xl font-bold text-slate-100 leading-snug">{entityTitle}</h1>
          </div>
          {current?.status === 'done' && current.overall_score && (
            <OverallBadge score={current.overall_score} />
          )}
        </div>

        {/* Topic selector */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Topic:</span>
          {topics.map(t => (
            <button
              key={t.id}
              onClick={() => { setTopic(t.id); setFilter('all'); }}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                selectedTopic === t.id
                  ? 'bg-violet-600 border-violet-600 text-white'
                  : 'border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.name}
              {analyses.find(a => a.topic_id === t.id)?.status === 'done' && (
                <span className="ml-1.5 text-[9px] opacity-70">✓</span>
              )}
            </button>
          ))}
        </div>

        {/* Run button */}
        {canManage && (
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <button
              onClick={runAnalysis}
              disabled={running || !selectedTopic}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
            >
              {running ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Analysing…
                </span>
              ) : current?.status === 'done' ? 'Re-run Analysis' : 'Run Analysis'}
            </button>
            {current?.status === 'done' && (
              <p className="text-xs text-slate-500">
                Last run {new Date(current.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
      </div>

      {/* Status states */}
      {!current && (
        <div className="card-dr py-12 text-center">
          <p className="text-slate-400">No analysis yet for this topic.</p>
          {canManage && <p className="text-sm text-slate-500 mt-1">Select a topic and click "Run Analysis" above.</p>}
          {!canManage && <p className="text-sm text-slate-500 mt-1">An analysis hasn't been run for this topic yet.</p>}
        </div>
      )}
      {current?.status === 'failed' && (
        <div className="card-dr px-5 py-4 border border-rose-500/20">
          <p className="text-sm text-rose-400">Analysis failed: {current.error_message ?? 'Unknown error'}</p>
        </div>
      )}
      {current?.status === 'running' && (
        <div className="card-dr py-12 text-center">
          <div className="inline-flex items-center gap-2 text-slate-400">
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Analysis running…
          </div>
        </div>
      )}

      {current?.status === 'done' && current.report && (
        <>
          {/* Summary */}
          <div className="card-dr px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Overall Assessment</p>
            <p className="text-sm text-slate-300 leading-relaxed">{current.report.summary}</p>
          </div>

          {/* Topic Owner Notes */}
          <div className="card-dr px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Topic Owner Notes</p>
              {canManage && !editingNotes && (
                <button onClick={() => { setEditNotes(true); setNotesText(current.notes ?? ''); }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  {current.notes ? 'Edit' : '+ Add notes'}
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  value={notesText}
                  onChange={e => setNotesText(e.target.value)}
                  rows={4}
                  placeholder="Add context or constraints for the AI to consider when re-running the analysis…"
                  className="w-full rounded-lg border border-blue-900/30 bg-slate-800/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500/50 focus:outline-none resize-y"
                />
                <div className="flex gap-2">
                  <button onClick={saveNotes} disabled={savingNotes}
                    className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors">
                    {savingNotes ? '…' : 'Save Notes'}
                  </button>
                  <button onClick={() => setEditNotes(false)} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Cancel</button>
                </div>
                <p className="text-xs text-slate-600">Notes will be included in the next re-run of the analysis.</p>
              </div>
            ) : current.notes ? (
              <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">{current.notes}</p>
            ) : (
              <p className="text-xs text-slate-600">{canManage ? 'No notes yet. Add context for the AI to consider.' : 'No notes added.'}</p>
            )}
          </div>

          {/* Principle filter */}
          {scores.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filterPrinciple === 'all' ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}
              >
                All Principles
              </button>
              {scores.map(s => (
                <button
                  key={s.principle_id}
                  onClick={() => setFilter(s.principle_id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filterPrinciple === s.principle_id ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}
                >
                  {s.principle_title}
                </button>
              ))}
            </div>
          )}

          {/* Scores */}
          <div className="space-y-4">
            {filtered.map(s => (
              <div key={s.principle_id} className="card-dr overflow-hidden">
                <div className="px-5 pt-4 pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-200 leading-snug">{s.principle_title}</h3>
                    </div>
                    <ScoreBadge score={s.score} label={s.score_label} />
                  </div>
                  {/* Score bar */}
                  <div className="mt-3 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${scoreColor(s.score)}`}
                      style={{ width: `${(s.score / 10) * 100}%` }}
                    />
                  </div>
                </div>
                {s.impacts.length > 0 && (
                  <div className="border-t border-slate-800/60 bg-slate-900/30 px-5 py-3 space-y-2">
                    {s.impacts.map((imp, i) => (
                      <div key={i} className="flex gap-3">
                        <span className="flex-shrink-0 rounded bg-slate-700/50 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-400 h-fit mt-0.5">
                          {imp.section}
                        </span>
                        <p className="text-xs text-slate-400 leading-relaxed">{imp.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
