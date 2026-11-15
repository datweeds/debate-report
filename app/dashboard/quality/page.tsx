'use client';

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

type Severity = 'critical' | 'major' | 'minor' | 'suggestion';

type DebateRow = {
  id: string; title: string; visibility: string; society: string | null;
  statement_count: number; score: number | null; last_run: string | null; last_status: string | null;
};

type Finding = {
  id: string; source: 'rules' | 'ai'; ruleId: string; fingerprint: string;
  severity: Severity; category: string; statementId: string | null; ref: string | null;
  fallacy: string | null; observation: string; recommendation: string;
  status: 'new' | 'open' | 'dismissed'; dismissedNote: string | null;
};

type Resolved = { fingerprint: string; severity: Severity; ref: string | null; observation: string; source: string };

type HistoryRow = {
  id: string; created_at: string; status: string; score: number | null;
  statement_count: number | null; run_by: string | null; finding_count: number;
};

type ReportData = {
  debate: { id: string; title: string };
  history: HistoryRow[];
  report: (HistoryRow & { ai_model: string | null; ai_summary: string | null; ai_error: string | null; previousId: string | null; finished_at: string | null }) | null;
  findings: Finding[];
  resolved: Resolved[];
};

const SEV: Record<Severity, { label: string; cls: string; dot: string }> = {
  critical:   { label: 'Critical',   cls: 'bg-red-500/15 text-red-300 border-red-500/40',          dot: 'bg-red-400' },
  major:      { label: 'Major',      cls: 'bg-orange-500/15 text-orange-300 border-orange-500/40', dot: 'bg-orange-400' },
  minor:      { label: 'Minor',      cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40',    dot: 'bg-amber-400' },
  suggestion: { label: 'Suggestion', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/40',          dot: 'bg-sky-400' },
};
const SEV_ORDER: Severity[] = ['critical', 'major', 'minor', 'suggestion'];

const CATEGORY_LABEL: Record<string, string> = {
  structure: 'Structure', support: 'Support', clarity: 'Clarity', references: 'References',
  duplication: 'Duplication', balance: 'Balance', logic: 'Logic', fallacy: 'Fallacy',
  relevance: 'Relevance', evidence: 'Evidence',
};

function fmt(d: string) {
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function scoreColour(s: number | null) {
  if (s == null) return 'text-slate-500';
  return s >= 80 ? 'text-emerald-400' : s >= 55 ? 'text-amber-400' : 'text-rose-400';
}

export default function QualityPage() {
  return <Suspense fallback={null}><QualityInner /></Suspense>;
}

function QualityInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get('debate');

  const [debates, setDebates]   = useState<DebateRow[] | null>(null);
  const [data, setData]         = useState<ReportData | null>(null);
  const [viewReport, setViewReport] = useState<string | null>(null);
  const [running, setRunning]   = useState(false);
  const [error, setError]       = useState('');
  const [sevFilter, setSevFilter] = useState<Set<Severity>>(new Set(SEV_ORDER));
  const [srcFilter, setSrcFilter] = useState<'all' | 'rules' | 'ai'>('all');
  const [showDismissed, setShowDismissed] = useState(false);
  const [showResolved, setShowResolved]   = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login?next=/dashboard/quality');
  }, [loading, user, router]);

  const loadDebates = useCallback(async () => {
    const res = await fetch('/api/quality');
    setDebates(res.ok ? (await res.json()).debates : []);
  }, []);
  useEffect(() => { if (user) loadDebates(); }, [user, loadDebates]);

  const loadReport = useCallback(async (id: string, reportId?: string | null) => {
    const res = await fetch(`/api/quality/${id}${reportId ? `?report=${reportId}` : ''}`);
    if (!res.ok) { setData(null); setError('Could not load this debate.'); return null; }
    const d: ReportData = await res.json();
    setData(d); setError('');
    return d;
  }, []);

  useEffect(() => {
    if (!selectedId) { setData(null); return; }
    setViewReport(null);
    loadReport(selectedId).then(d => { if (d?.report?.status === 'running') setRunning(true); });
  }, [selectedId, loadReport]);

  // Poll while a run is in progress
  useEffect(() => {
    if (!running || !selectedId) return;
    const t = setInterval(async () => {
      const d = await loadReport(selectedId);
      if (d?.report?.status !== 'running') { setRunning(false); setViewReport(null); loadDebates(); }
    }, 4000);
    return () => clearInterval(t);
  }, [running, selectedId, loadReport, loadDebates]);

  async function runReport() {
    if (!selectedId) return;
    setError('');
    const res = await fetch(`/api/quality/${selectedId}`, { method: 'POST' });
    if (!res.ok) { setError('Could not start the report.'); return; }
    setRunning(true);
    loadReport(selectedId);
  }

  async function dismiss(f: Finding) {
    const note = window.prompt('Dismiss this finding? Add a note for other moderators (optional):', '');
    if (note === null || !selectedId) return;
    await fetch(`/api/quality/${selectedId}/dismiss`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint: f.fingerprint, note, observation: f.observation }),
    });
    loadReport(selectedId, viewReport);
  }

  async function restore(f: Finding) {
    if (!selectedId) return;
    await fetch(`/api/quality/${selectedId}/dismiss?fingerprint=${encodeURIComponent(f.fingerprint)}`, { method: 'DELETE' });
    loadReport(selectedId, viewReport);
  }

  const visible = useMemo(() => (data?.findings ?? [])
    .filter(f => sevFilter.has(f.severity))
    .filter(f => srcFilter === 'all' || f.source === srcFilter)
    .filter(f => showDismissed ? f.status === 'dismissed' : f.status !== 'dismissed')
    .sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity)
      || (a.status === 'new' ? -1 : 0) - (b.status === 'new' ? -1 : 0)),
  [data, sevFilter, srcFilter, showDismissed]);

  const counts = useMemo(() => {
    const c: Record<Severity, number> = { critical: 0, major: 0, minor: 0, suggestion: 0 };
    (data?.findings ?? []).filter(f => f.status !== 'dismissed').forEach(f => c[f.severity]++);
    return c;
  }, [data]);
  const newCount = (data?.findings ?? []).filter(f => f.status === 'new').length;
  const dismissedCount = (data?.findings ?? []).filter(f => f.status === 'dismissed').length;

  if (loading || !user) return null;

  const report = data?.report ?? null;
  const isLatest = report && data?.history[0]?.id === report.id;
  const completedHistory = (data?.history ?? []).filter(h => h.status === 'complete' && h.score != null).slice(0, 12).reverse();

  return (
    <div className="px-4 sm:px-8 py-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Debate Quality</h1>
        <p className="text-sm text-slate-500 mt-1">
          Checks a debate against Public Forum structure, house style and sound reasoning, and lists what to fix.
          Re-run after making changes to track progress.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* ── Debate picker ─────────────────────────────────────── */}
        <aside className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-600">Debates</p>
          {debates === null ? (
            <div className="h-20 rounded-xl bg-slate-800/40 animate-pulse" />
          ) : debates.length === 0 ? (
            <p className="text-sm text-slate-500 rounded-xl border border-slate-800 bg-[#0c1322] p-4">
              You don&apos;t moderate any debates yet. Society Admins can review their Society&apos;s debates here.
            </p>
          ) : debates.map(d => (
            <button
              key={d.id}
              onClick={() => router.replace(`/dashboard/quality?debate=${d.id}`)}
              className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                d.id === selectedId ? 'border-blue-500/60 bg-blue-500/10' : 'border-slate-800 bg-[#0c1322] hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm text-slate-200 leading-snug line-clamp-2">{d.title}</span>
                <span className={`text-sm font-bold tabular-nums ${scoreColour(d.score)}`}>{d.score ?? '—'}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {d.society ?? 'No Society'} · {d.statement_count} statements
                {d.last_run ? ` · run ${fmt(d.last_run)}` : ' · never run'}
              </p>
            </button>
          ))}
        </aside>

        {/* ── Report ────────────────────────────────────────────── */}
        <section className="min-w-0">
          {!selectedId ? (
            <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-10 text-center text-sm text-slate-500">
              Choose a debate to see or run its quality report.
            </div>
          ) : !data ? (
            error ? <p className="text-sm text-rose-400">{error}</p> : <div className="h-40 rounded-2xl bg-slate-800/40 animate-pulse" />
          ) : (
            <div className="space-y-5">
              {/* Header */}
              <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-slate-100 leading-snug">{data.debate.title}</h2>
                    <Link href={`/chamber?resolution=${data.debate.id}`} className="text-xs text-blue-400 hover:underline">
                      Open in the Chamber →
                    </Link>
                  </div>
                  <button
                    onClick={runReport}
                    disabled={running}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
                  >
                    {running ? 'Running… (1–2 min)' : report ? 'Re-run report' : 'Run report'}
                  </button>
                </div>
                {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}

                {report && report.status !== 'running' && (
                  <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-slate-500">Score</p>
                      <p className={`text-4xl font-bold tabular-nums ${scoreColour(report.score)}`}>{report.score ?? '—'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {SEV_ORDER.map(s => (
                        <span key={s} className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${SEV[s].cls}`}>
                          {counts[s]} {SEV[s].label}
                        </span>
                      ))}
                      {newCount > 0 && report.previousId && (
                        <span className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-300">{newCount} new</span>
                      )}
                      {data.resolved.length > 0 && (
                        <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">{data.resolved.length} resolved</span>
                      )}
                    </div>
                    {completedHistory.length > 1 && (
                      <div className="ml-auto">
                        <p className="text-[11px] uppercase tracking-widest text-slate-500 mb-1">Score history</p>
                        <div className="flex items-end gap-1 h-10" aria-label="Score history">
                          {completedHistory.map(h => (
                            <button
                              key={h.id}
                              title={`${fmt(h.created_at)}: ${h.score}`}
                              onClick={() => { setViewReport(h.id); loadReport(data.debate.id, h.id); }}
                              className={`w-3 rounded-sm ${h.id === report.id ? 'bg-blue-400' : 'bg-slate-600 hover:bg-slate-400'}`}
                              style={{ height: `${Math.max(8, h.score ?? 0)}%` }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {report && (
                  <p className="mt-4 text-xs text-slate-500">
                    {report.status === 'running' ? 'Report running…' : `Run ${fmt(report.created_at)}`}
                    {report.run_by ? ` by @${report.run_by}` : ''}
                    {report.statement_count != null ? ` · ${report.statement_count} statements` : ''}
                    {!isLatest && (
                      <>
                        {' · '}<span className="text-amber-400">viewing an earlier report</span>{' '}
                        <button onClick={() => { setViewReport(null); loadReport(data.debate.id); }} className="text-blue-400 hover:underline">show latest</button>
                      </>
                    )}
                  </p>
                )}
                {report?.status === 'failed' && <p className="mt-2 text-sm text-rose-400">{report.ai_error}</p>}
              </div>

              {!report && !running && (
                <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-8 text-center text-sm text-slate-500">
                  This debate hasn&apos;t been reviewed yet. Run the report to see its findings.
                </div>
              )}

              {report?.status === 'complete' && (
                <>
                  {report.ai_summary && (
                    <div className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-300 mb-1">Reviewer&apos;s summary</p>
                      <p className="text-sm text-slate-300 leading-relaxed">{report.ai_summary}</p>
                    </div>
                  )}
                  {report.ai_error && (
                    <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">{report.ai_error}</p>
                  )}

                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-2">
                    {SEV_ORDER.map(s => {
                      const on = sevFilter.has(s);
                      return (
                        <button key={s}
                          onClick={() => setSevFilter(prev => { const n = new Set(prev); if (on) n.delete(s); else n.add(s); return n; })}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? SEV[s].cls : 'border-slate-700 text-slate-500'}`}
                        >
                          {SEV[s].label}
                        </button>
                      );
                    })}
                    <span className="mx-1 h-4 w-px bg-slate-700" />
                    {(['all', 'rules', 'ai'] as const).map(s => (
                      <button key={s} onClick={() => setSrcFilter(s)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          srcFilter === s ? 'border-slate-400 text-slate-200 bg-slate-700/40' : 'border-slate-700 text-slate-500'
                        }`}>
                        {s === 'all' ? 'All checks' : s === 'rules' ? 'Structure rules' : 'Reasoning review'}
                      </button>
                    ))}
                    {dismissedCount > 0 && (
                      <button onClick={() => setShowDismissed(v => !v)}
                        className={`ml-auto rounded-full border px-3 py-1 text-xs font-medium ${showDismissed ? 'border-slate-400 text-slate-200' : 'border-slate-700 text-slate-500'}`}>
                        {showDismissed ? 'Hide dismissed' : `Dismissed (${dismissedCount})`}
                      </button>
                    )}
                  </div>

                  {/* Findings */}
                  {visible.length === 0 ? (
                    <p className="rounded-xl border border-slate-800 bg-[#0c1322] p-6 text-center text-sm text-slate-500">
                      {showDismissed ? 'No dismissed findings.' : 'Nothing to show with these filters.'}
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {visible.map(f => (
                        <li key={f.id} className={`rounded-xl border bg-[#0c1322] p-4 ${f.status === 'dismissed' ? 'border-slate-800 opacity-70' : 'border-slate-800'}`}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${SEV[f.severity].cls}`}>{SEV[f.severity].label}</span>
                            {f.status === 'new' && report.previousId && (
                              <span className="rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-300">New</span>
                            )}
                            {f.ref && f.statementId ? (
                              <Link href={`/chamber?resolution=${data.debate.id}&statement=${f.statementId}`} target="_blank"
                                className="rounded-md border border-slate-600 bg-slate-700/30 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-200 hover:border-blue-400">
                                {f.ref} ↗
                              </Link>
                            ) : (
                              <span className="rounded-md border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400">Whole debate</span>
                            )}
                            <span className="text-[11px] text-slate-500">
                              {f.fallacy ? `Fallacy · ${f.fallacy}` : CATEGORY_LABEL[f.category] ?? f.category}
                              {' · '}{f.source === 'ai' ? 'Reasoning review' : 'Structure rule'}
                            </span>
                            <span className="ml-auto">
                              {f.status === 'dismissed' ? (
                                <button onClick={() => restore(f)} className="text-xs text-blue-400 hover:underline">Restore</button>
                              ) : isLatest ? (
                                <button onClick={() => dismiss(f)} className="text-xs text-slate-500 hover:text-slate-300">Dismiss</button>
                              ) : null}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-200 leading-relaxed">
                            {f.fallacy && f.observation.startsWith(`${f.fallacy}: `) ? f.observation.slice(f.fallacy.length + 2) : f.observation}
                          </p>
                          <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                            <span className="font-semibold text-emerald-400">Fix: </span>{f.recommendation}
                          </p>
                          {f.status === 'dismissed' && f.dismissedNote && (
                            <p className="mt-2 text-xs text-slate-500 italic">Dismissed: {f.dismissedNote}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Resolved since the previous run */}
                  {data.resolved.length > 0 && (
                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5">
                      <button onClick={() => setShowResolved(v => !v)} className="w-full px-4 py-3 text-left text-sm font-semibold text-emerald-300">
                        {showResolved ? '▾' : '▸'} Resolved since the previous report ({data.resolved.length})
                      </button>
                      {showResolved && (
                        <ul className="px-4 pb-3 space-y-2">
                          {data.resolved.map(r => (
                            <li key={r.fingerprint} className="text-xs text-slate-400 leading-relaxed">
                              <span className={`inline-block h-2 w-2 rounded-full mr-2 ${SEV[r.severity].dot}`} />
                              {r.ref && <span className="font-mono text-slate-300 mr-1">{r.ref}</span>}
                              <span className="line-through decoration-slate-600">{r.observation}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Structure rules give the same result every run. The reasoning review is an AI assessment{report.ai_model ? ` (${report.ai_model})` : ''}: treat it as advice, and dismiss findings you disagree with. Wording and matching of these findings can vary slightly between runs.
                  </p>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
