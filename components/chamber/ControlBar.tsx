'use client';

import { useState } from 'react';
import { SUBJECT_LABELS, SUBJECT_COLOURS } from './constants';
import type { ChamberData } from './types';

const DECISION_LABEL: Record<string, string> = {
  for:     'For wins',
  against: 'Against wins',
  draw:    'Draw',
};
const DECISION_COLOUR: Record<string, string> = {
  for:     'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  against: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  draw:    'bg-slate-700 text-slate-400 border-slate-600',
};

type Props = {
  data: ChamberData | null;
  showRetracted: boolean;
  isFavourite: boolean;
  scaleFor: number;
  scaleAgainst: number;
  selectedFlagCount: number | null;
  onToggleRetracted: () => void;
  onToggleFavourite: () => void;
  onOpenSwitchboard: () => void;
  onPrint: () => void;
  onOpenAnalysis: () => void;
  onFlag: () => void;
  onOpenListSheet?: () => void;
  onOpenMetricsSheet?: () => void;
  canAnalyse?: boolean;
};

export default function ControlBar({
  data, showRetracted, isFavourite,
  scaleFor, scaleAgainst, selectedFlagCount,
  onToggleRetracted, onToggleFavourite, onOpenSwitchboard, onPrint, onOpenAnalysis, onFlag,
  onOpenListSheet, onOpenMetricsSheet, canAnalyse,
}: Props) {
  const res = data?.resolution;
  const retractedCount = data?.statements.filter(s => s.retracted_at).length ?? 0;
  const [showRationale, setShowRationale] = useState(false);
  const isClosed = res?.stat_status === 'closed';

  const totalVotes = scaleFor + scaleAgainst;
  const forPercent = totalVotes > 0 ? Math.round((scaleFor / totalVotes) * 100) : 50;

  return (
    <div className="flex-shrink-0 border-b border-slate-800 bg-[#080d1a]">

      {/* Row 1: label | resolution title | controls */}
      <div className="flex items-center min-h-[48px] border-b border-slate-800/50 flex-wrap sm:flex-nowrap">

        {/* "Debating Chamber" label — desktop only */}
        <div className="hidden sm:flex items-center gap-2 px-5 flex-shrink-0 border-r border-slate-800 h-12">
          <span className="text-sm font-bold text-slate-200 whitespace-nowrap">Debating Chamber</span>
        </div>

        {/* Resolution title */}
        <div className="flex-1 px-3 sm:px-5 min-w-0 flex items-center gap-2 h-12">
          {res ? (
            <>
              {isClosed && (
                <span className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-orange-500/15 text-orange-400 border border-orange-500/30">
                  Closed
                </span>
              )}
              <p className="text-sm text-slate-300 truncate">
                <span className="text-slate-500 mr-1.5 hidden sm:inline">Resolution:</span>
                {res.stat_title}
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-600 italic">No debate selected</p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 px-2 sm:px-4 flex-shrink-0 border-l border-slate-800 h-12">

          {/* Scale bar — desktop only */}
          {data && totalVotes > 0 && (
            <div className="hidden sm:flex items-center gap-2 mr-1">
              <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">For {forPercent}%</span>
              <div className="w-28 h-2.5 rounded-full overflow-hidden bg-rose-500/40" title={`For: ${scaleFor} · Against: ${scaleAgainst}`}>
                <div className="h-full bg-blue-500 transition-all duration-500 rounded-full" style={{ width: `${forPercent}%` }} />
              </div>
              <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">{100 - forPercent}% Ag</span>
            </div>
          )}

          {/* Flag — icon always, text on desktop */}
          {selectedFlagCount !== null && (
            <button
              onClick={onFlag}
              title={selectedFlagCount > 0 ? `Flagged ${selectedFlagCount} time${selectedFlagCount !== 1 ? 's' : ''}` : 'Flag this statement'}
              className="flex items-center gap-1 rounded px-2 py-1.5 text-xs font-bold transition-colors"
              style={selectedFlagCount > 0
                ? { background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)' }
                : { background: 'rgba(30,41,59,1)', color: '#94a3b8', border: '1px solid rgba(71,85,105,0.5)' }
              }
            >
              <svg className="h-3.5 w-3.5" fill={selectedFlagCount > 0 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={selectedFlagCount > 0 ? 0 : 2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
              </svg>
              {selectedFlagCount > 0 && <span className="hidden sm:inline">Flagged ({selectedFlagCount})</span>}
            </button>
          )}

          {/* Analysis — paid only */}
          {data && canAnalyse && (
            <button onClick={onOpenAnalysis} title="Debate analysis"
              className="flex items-center gap-1 rounded px-2 py-1.5 text-xs font-bold bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
              </svg>
              <span className="hidden sm:inline">Analysis</span>
            </button>
          )}

          {/* Favourite — icon always */}
          {data && (
            <button onClick={onToggleFavourite} title={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
              className="flex items-center justify-center rounded px-2 py-1.5 transition-colors hover:bg-slate-800">
              <svg className={`h-4 w-4 transition-colors ${isFavourite ? 'text-red-500 fill-red-500' : 'text-blue-400'}`}
                fill={isFavourite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={isFavourite ? 0 : 1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
            </button>
          )}

          {/* Print — desktop only */}
          {data && (
            <button onClick={onPrint} title="Export graph as SVG"
              className="hidden sm:flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-bold bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
              </svg>
              Print
            </button>
          )}

          {/* Retracted — desktop only */}
          {retractedCount > 0 && (
            <button onClick={onToggleRetracted}
              title={`${retractedCount} retracted statement${retractedCount !== 1 ? 's' : ''}`}
              className={`hidden sm:block rounded px-3 py-1.5 text-xs font-bold transition-colors ${
                showRetracted ? 'bg-slate-600 text-slate-200' : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-400'
              }`}>
              {showRetracted ? 'Hide Retracted' : `Retracted (${retractedCount})`}
            </button>
          )}

          {/* List — mobile only */}
          {data && onOpenListSheet && (
            <button onClick={onOpenListSheet} title="Statement list"
              className="sm:hidden flex items-center justify-center rounded px-2 py-1.5 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
            </button>
          )}

          {/* Metrics — mobile only */}
          {data && onOpenMetricsSheet && (
            <button onClick={onOpenMetricsSheet} title="Metrics"
              className="sm:hidden flex items-center justify-center rounded px-2 py-1.5 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            </button>
          )}

          {/* Switch Debate — always visible */}
          <button onClick={onOpenSwitchboard}
            className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-bold bg-amber-600/80 text-amber-100 hover:bg-amber-500 transition-colors">
            <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
            <span className="hidden sm:inline">Switch Debate</span>
          </button>
        </div>
      </div>

      {/* Row 2: meta — desktop only */}
      {res && (
        <div className="hidden sm:flex items-center gap-4 px-5 h-9 text-xs text-slate-500">
          <span>
            Subject Area:{' '}
            <span className={`font-semibold ${SUBJECT_COLOURS[res.subject_area]?.split(' ')[1] ?? 'text-slate-300'}`}>
              {SUBJECT_LABELS[res.subject_area] ?? res.subject_area}
            </span>
          </span>
          <span className="text-slate-700">|</span>
          <span>Forum: <span className="text-slate-400">House Public Debates</span></span>
          <span className="text-slate-700">|</span>
          <span>View: <span className="text-slate-400 capitalize">{res.forum_visibility}</span></span>
        </div>
      )}

      {/* Row 3: closed debate summary */}
      {isClosed && res && (
        <div className="flex items-center gap-4 px-5 h-9 border-t border-orange-500/10 bg-orange-500/5 text-xs">
          <span className="text-slate-500">Final vote:</span>
          <span className="text-emerald-400 font-semibold">✓ For: {res.vote_total_for}</span>
          <span className="text-rose-400 font-semibold">✗ Against: {res.vote_total_against}</span>
          {res.resolution_decision && (
            <>
              <span className="text-slate-700">|</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${DECISION_COLOUR[res.resolution_decision] ?? ''}`}>
                {DECISION_LABEL[res.resolution_decision] ?? res.resolution_decision}
              </span>
            </>
          )}
          {res.closing_statement && (
            <>
              <span className="text-slate-700">|</span>
              <button onClick={() => setShowRationale(v => !v)}
                className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">
                {showRationale ? 'Hide rationale' : 'View rationale'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Rationale popup */}
      {showRationale && res?.closing_statement && (
        <div className="px-5 py-3 border-t border-slate-800 bg-[#0a1020]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-400 mb-1">Owner&apos;s rationale</p>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{res.closing_statement}</p>
            </div>
            <button onClick={() => setShowRationale(false)} className="flex-shrink-0 text-slate-600 hover:text-slate-400 transition-colors">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
