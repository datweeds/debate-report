'use client';

import { useState, useEffect } from 'react';
import type { Resolution, FullStatement } from './types';

type Ref = { side: 'supporting' | 'opposing'; position: number; title: string; summary: string; link: string };

type Analysis = {
  id: string;
  claim: string;
  pro_analysis: string;
  con_analysis: string;
  synthesis: string;
  created_at: string;
};

type Props = {
  statement: FullStatement | Resolution;
  onClose: () => void;
  onAnalysisComplete?: () => void;
};

type Tab = 'pro' | 'con' | 'synthesis';

function RefTable({ refs, side }: { refs: Ref[]; side: 'supporting' | 'opposing' }) {
  const rows = refs.filter(r => r.side === side).sort((a, b) => a.position - b.position);
  if (!rows.length) return null;
  const label = side === 'supporting' ? 'Supporting the Statement (Pro)' : 'Opposing the Statement (Con)';
  return (
    <div className="mt-6">
      <h3 className="text-sm font-bold text-slate-200 mb-3">References {label}</h3>
      <div className="overflow-x-auto rounded-xl border border-slate-700/50">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700/60 bg-slate-800/40">
              <th className="px-3 py-2 text-left text-slate-500 font-semibold w-8">Ref</th>
              <th className="px-3 py-2 text-left text-slate-500 font-semibold w-40">Title</th>
              <th className="px-3 py-2 text-left text-slate-500 font-semibold">Summary</th>
              <th className="px-3 py-2 text-left text-slate-500 font-semibold w-48">Link</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.position} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/20">
                <td className="px-3 py-2.5 text-slate-500 align-top">{r.position}</td>
                <td className="px-3 py-2.5 text-slate-300 align-top">{r.title}</td>
                <td className="px-3 py-2.5 text-slate-400 leading-relaxed align-top">{r.summary}</td>
                <td className="px-3 py-2.5 align-top">
                  {r.link ? (
                    <a
                      href={r.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 break-all leading-relaxed"
                    >
                      {r.link.replace(/^https?:\/\//, '')}
                    </a>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SciencePoweredBy() {
  return (
    <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-800">
      <div className="text-right">
        <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-0.5">powered by</p>
        <div className="flex items-center gap-1.5 justify-end">
          {/* Orb icon mimicking The Science App logo */}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <defs>
              <radialGradient id="orb" cx="40%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#f472b6" />
                <stop offset="50%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#6366f1" />
              </radialGradient>
            </defs>
            <circle cx="9" cy="9" r="8.5" fill="url(#orb)" />
          </svg>
          <div>
            <p className="text-xs font-bold text-slate-300 leading-none">The Science App</p>
            <p className="text-[9px] text-slate-500 leading-none mt-0.5">HaAI Labs</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ScienceModal({ statement, onClose, onAnalysisComplete }: Props) {
  const [tab, setTab]           = useState<Tab>('synthesis');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [refs, setRefs]         = useState<Ref[]>([]);
  const [loading, setLoading]   = useState(true);
  const [running, setRunning]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/statements/${statement.id}/science`)
      .then(r => r.json())
      .then(d => {
        setAnalysis(d.analysis ?? null);
        setRefs(d.refs ?? []);
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [statement.id]);

  async function runAnalysis() {
    setRunning(true); setError('');
    try {
      const res = await fetch(`/api/statements/${statement.id}/science`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? 'Analysis failed'); return; }
      setAnalysis(d.analysis);
      setRefs(d.refs ?? []);
      onAnalysisComplete?.();
    } catch {
      setError('Network error');
    } finally {
      setRunning(false);
    }
  }

  const title = statement.stat_title;

  const TAB_LABEL: Record<Tab, string> = { pro: 'Pro', con: 'Con', synthesis: 'Synthesis' };
  const tabText: Record<Tab, string> = {
    pro:       analysis?.pro_analysis  ?? '',
    con:       analysis?.con_analysis  ?? '',
    synthesis: analysis?.synthesis     ?? '',
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#080d1a]">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          {/* Flask icon */}
          <svg className="h-5 w-5 text-teal-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15a2.25 2.25 0 0 1 .45 1.32v.74c0 .513.416.929.93.929h.12a.93.93 0 0 0 .93-.93v-.74A2.25 2.25 0 0 1 21.68 15M19.8 15H4.2m0 0a2.25 2.25 0 0 0-.45 1.32v.74c0 .513-.416.929-.93.929h-.12a.93.93 0 0 1-.93-.93v-.74c0-.505.19-.982.53-1.32" />
          </svg>
          <h2 className="text-base font-bold text-slate-100">Scientific Analysis of Statement</h2>
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

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 max-w-5xl w-full mx-auto">
        {/* Statement context */}
        <div className="mb-5">
          <p className="text-xs text-slate-500 mb-2">
            This report has been compiled by a trained AI analyst searching for relevant scientific research in peer-reviewed scientific papers. The statement is:
          </p>
          <p className="text-base font-bold text-slate-100 leading-snug">{title}</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3">
            <svg className="h-6 w-6 text-teal-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4}/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p className="text-sm text-slate-400">Loading…</p>
          </div>
        ) : !analysis ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <svg className="h-10 w-10 text-slate-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15a2.25 2.25 0 0 1 .45 1.32v.74c0 .513.416.929.93.929h.12a.93.93 0 0 0 .93-.93v-.74A2.25 2.25 0 0 1 21.68 15M19.8 15H4.2" />
            </svg>
            <p className="text-sm text-slate-400">No scientific analysis yet for this statement.</p>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              onClick={runAnalysis}
              disabled={running}
              className="flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50 transition-colors"
            >
              {running ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4}/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Analysing…
                </>
              ) : 'Run Scientific Analysis'}
            </button>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex items-center gap-1 mb-5 p-1 bg-slate-800/50 rounded-xl w-fit">
              {(['pro', 'con', 'synthesis'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                    tab === t
                      ? t === 'pro' ? 'bg-emerald-600 text-white'
                        : t === 'con' ? 'bg-rose-600 text-white'
                        : 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {TAB_LABEL[t]}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 px-5 py-4">
              {tab === 'pro' && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-2">Pro — Evidence supporting the statement</p>
              )}
              {tab === 'con' && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400 mb-2">Con — Evidence opposing the statement</p>
              )}
              {tab === 'synthesis' && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-2">Synthesis of the evidence</p>
              )}
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                {tabText[tab] || <span className="text-slate-500 italic">No content available.</span>}
              </p>
            </div>

            {/* References */}
            <RefTable refs={refs} side="supporting" />
            <RefTable refs={refs} side="opposing" />

            {/* Metadata + refresh */}
            <div className="mt-6 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <p className="text-xs text-slate-600">
                  Analysis generated {new Date(analysis.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <button
                  onClick={runAnalysis}
                  disabled={running}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors disabled:opacity-50"
                >
                  {running ? (
                    <>
                      <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4}/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Refreshing…
                    </>
                  ) : (
                    <>
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                      Refresh Report
                    </>
                  )}
                </button>
                {error && <p className="text-xs text-red-400">{error}</p>}
              </div>
            </div>

            <SciencePoweredBy />
          </>
        )}
      </div>
    </div>
  );
}
