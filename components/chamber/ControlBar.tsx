'use client';

import { SUBJECT_LABELS, SUBJECT_COLOURS } from './constants';
import type { ChamberData } from './types';

type Props = {
  data: ChamberData | null;
  showList: boolean;
  showDetail: boolean;
  showRetracted: boolean;
  onToggleList: () => void;
  onToggleDetail: () => void;
  onToggleRetracted: () => void;
  onOpenSwitchboard: () => void;
};

export default function ControlBar({
  data, showList, showDetail, showRetracted,
  onToggleList, onToggleDetail, onToggleRetracted, onOpenSwitchboard,
}: Props) {
  const res = data?.resolution;
  const retractedCount = data?.statements.filter(s => s.retracted_at).length ?? 0;

  return (
    <div className="flex-shrink-0 border-b border-slate-800 bg-[#080d1a]">

      {/* Row 1: label | resolution title | panel toggles */}
      <div className="flex items-center h-12 border-b border-slate-800/50">

        <div className="flex items-center gap-2 px-5 flex-shrink-0 border-r border-slate-800 h-full">
          <span className="text-sm font-bold text-slate-200 whitespace-nowrap">Debating Chamber</span>
        </div>

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

          {/* Show Retracted — only visible when there are retracted statements */}
          {retractedCount > 0 && (
            <button
              onClick={onToggleRetracted}
              title={`${retractedCount} retracted statement${retractedCount !== 1 ? 's' : ''}`}
              className={`ml-1 rounded px-3 py-1.5 text-xs font-bold transition-colors ${
                showRetracted
                  ? 'bg-slate-600 text-slate-200'
                  : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-400'
              }`}
            >
              {showRetracted ? 'Hide Retracted' : `Retracted (${retractedCount})`}
            </button>
          )}

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

      {/* Row 2: meta */}
      {res && (
        <div className="flex items-center gap-4 px-5 h-9 text-xs text-slate-500">
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
    </div>
  );
}
