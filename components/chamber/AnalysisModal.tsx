'use client';

import { useEffect, useState } from 'react';

type StatementPoint = { period: string; for: number; against: number; neutral: number };
type ChatPoint      = { period: string; count: number };
type AnalysisData   = {
  timeUnit: 'day' | 'month';
  statementSeries: StatementPoint[];
  chatSeries: ChatPoint[];
};

type Props = {
  resolutionId: string;
  resolutionTitle: string;
  onClose: () => void;
};

// ── SVG chart helpers ─────────────────────────────────────────────────────────

const CW = 520;
const CH = 160;
const ML = 36;
const MR = 16;
const MT = 14;
const MB = 36;
const IW = CW - ML - MR;
const IH = CH - MT - MB;

function fmtPeriod(p: string, timeUnit: 'day' | 'month'): string {
  if (timeUnit === 'month') {
    const [y, m] = p.split('-');
    return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
  }
  const d = new Date(p);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function StackedBarChart({ data, timeUnit }: { data: StatementPoint[]; timeUnit: 'day' | 'month' }) {
  if (!data.length) return <p className="text-center text-sm text-slate-500 py-8">No data</p>;

  const n      = data.length;
  const maxVal = Math.max(...data.map(d => d.for + d.against + d.neutral), 1);
  const barW   = Math.min(IW / n - 4, 40);
  const step   = IW / n;

  const yTicks    = [0, Math.ceil(maxVal / 2), maxVal];
  const yScale    = (v: number) => IH - (v / maxVal) * IH;
  const showEvery = Math.ceil(n / 10);

  return (
    <svg width="100%" viewBox={`0 0 ${CW} ${CH}`} className="overflow-visible">
      {/* Grid lines */}
      {yTicks.map(t => (
        <g key={t}>
          <line x1={ML} y1={MT + yScale(t)} x2={ML + IW} y2={MT + yScale(t)} stroke="#334155" strokeWidth={1} />
          <text x={ML - 5} y={MT + yScale(t) + 4} textAnchor="end" fontSize={9} fill="#94a3b8">{t}</text>
        </g>
      ))}

      {/* Bars */}
      {data.map((d, i) => {
        const bx   = ML + i * step + (step - barW) / 2;
        const forH = (d.for     / maxVal) * IH;
        const agH  = (d.against / maxVal) * IH;
        const neuH = (d.neutral / maxVal) * IH;
        return (
          <g key={d.period}>
            <rect x={bx} y={MT + yScale(d.for)}                   width={barW} height={forH} fill="#3b82f6c0" rx={2} />
            <rect x={bx} y={MT + yScale(d.for + d.against)}       width={barW} height={agH}  fill="#ef4444c0" rx={2} />
            <rect x={bx} y={MT + yScale(d.for + d.against + d.neutral)} width={barW} height={neuH} fill="#47556980" rx={2} />
            {i % showEvery === 0 && (
              <text
                x={bx + barW / 2} y={MT + IH + 14}
                textAnchor="middle" fontSize={8} fill="#94a3b8"
                transform={n > 8 ? `rotate(-35, ${bx + barW / 2}, ${MT + IH + 14})` : undefined}
              >
                {fmtPeriod(d.period, timeUnit)}
              </text>
            )}
          </g>
        );
      })}

      {/* Axes */}
      <line x1={ML} y1={MT}      x2={ML}      y2={MT + IH} stroke="#475569" strokeWidth={1.5} />
      <line x1={ML} y1={MT + IH} x2={ML + IW} y2={MT + IH} stroke="#475569" strokeWidth={1.5} />
    </svg>
  );
}

function LineChart({ data, timeUnit }: { data: ChatPoint[]; timeUnit: 'day' | 'month' }) {
  if (!data.length) return <p className="text-center text-sm text-slate-500 py-8">No data</p>;

  const n         = data.length;
  const maxVal    = Math.max(...data.map(d => d.count), 1);
  const step      = IW / Math.max(n - 1, 1);
  const yScale    = (v: number) => IH - (v / maxVal) * IH;
  const showEvery = Math.ceil(n / 10);

  const points  = data.map((d, i) => ({ x: ML + i * step, y: MT + yScale(d.count) }));
  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
  const yTicks   = [0, Math.ceil(maxVal / 2), maxVal];

  return (
    <svg width="100%" viewBox={`0 0 ${CW} ${CH}`} className="overflow-visible">
      {/* Grid */}
      {yTicks.map(t => (
        <g key={t}>
          <line x1={ML} y1={MT + yScale(t)} x2={ML + IW} y2={MT + yScale(t)} stroke="#334155" strokeWidth={1} />
          <text x={ML - 5} y={MT + yScale(t) + 4} textAnchor="end" fontSize={9} fill="#94a3b8">{t}</text>
        </g>
      ))}

      {/* Area fill */}
      <polygon
        points={`${ML},${MT + IH} ${polyline} ${ML + (n - 1) * step},${MT + IH}`}
        fill="#a855f740"
      />

      {/* Line */}
      <polyline points={polyline} fill="none" stroke="#a855f7" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

      {/* Data points + x labels */}
      {points.map((p, i) => (
        <g key={data[i].period}>
          <circle cx={p.x} cy={p.y} r={3.5} fill="#a855f7" />
          {data[i].count > 0 && (
            <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize={8} fill="#d8b4fe">{data[i].count}</text>
          )}
          {i % showEvery === 0 && (
            <text
              x={p.x} y={MT + IH + 14}
              textAnchor="middle" fontSize={8} fill="#94a3b8"
              transform={n > 8 ? `rotate(-35, ${p.x}, ${MT + IH + 14})` : undefined}
            >
              {fmtPeriod(data[i].period, timeUnit)}
            </text>
          )}
        </g>
      ))}

      {/* Axes */}
      <line x1={ML} y1={MT}      x2={ML}      y2={MT + IH} stroke="#475569" strokeWidth={1.5} />
      <line x1={ML} y1={MT + IH} x2={ML + IW} y2={MT + IH} stroke="#475569" strokeWidth={1.5} />
    </svg>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function AnalysisModal({ resolutionId, resolutionTitle, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [data,    setData]    = useState<AnalysisData | null>(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`/api/chamber/${resolutionId}/analysis`)
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d.error ?? 'Failed')))
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(typeof e === 'string' ? e : 'Could not load analysis'); setLoading(false); });
  }, [resolutionId]);

  const totalFor     = data?.statementSeries.reduce((s, p) => s + p.for,     0) ?? 0;
  const totalAgainst = data?.statementSeries.reduce((s, p) => s + p.against, 0) ?? 0;
  const totalChat    = data?.chatSeries.reduce((s, p) => s + p.count, 0) ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#0c1322] shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-100">Debate Analysis</h2>
            <p className="text-xs text-slate-500 truncate mt-0.5">{resolutionTitle}</p>
          </div>
          <button onClick={onClose} className="ml-4 flex-shrink-0 rounded-lg p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-slate-500">Loading analysis…</p>
            </div>
          )}
          {error && <p className="text-sm text-red-400 text-center py-8">{error}</p>}

          {data && !loading && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-blue-300">{totalFor}</p>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mt-0.5">For statements</p>
                </div>
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-rose-300">{totalAgainst}</p>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mt-0.5">Against statements</p>
                </div>
                <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-violet-300">{totalChat}</p>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mt-0.5">Chat messages</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-300">Statements over time</h3>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500/80" />For</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500/80" />Against</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-slate-500/60" />Neutral</span>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#080d1a] p-3">
                  <StackedBarChart data={data.statementSeries} timeUnit={data.timeUnit} />
                </div>
                <p className="text-[10px] text-slate-600 mt-1">
                  Grouped by {data.timeUnit === 'day' ? 'day' : 'month'} · {data.statementSeries.length} period{data.statementSeries.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Chat activity over time</h3>
                <div className="rounded-xl border border-slate-800 bg-[#080d1a] p-3">
                  <LineChart data={data.chatSeries} timeUnit={data.timeUnit} />
                </div>
                <p className="text-[10px] text-slate-600 mt-1">
                  Accepted messages across all statements in this debate
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
