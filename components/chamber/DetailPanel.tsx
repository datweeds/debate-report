'use client';

import { STAT_BADGE, STAT_LABEL } from './constants';
import type { FullStatement, Resolution } from './types';

type Props = {
  statement: FullStatement | Resolution | null;
  onClose: () => void;
};

export default function DetailPanel({ statement, onClose }: Props) {
  if (!statement) return null;

  const fullStat = statement as FullStatement;
  const statType = 'stat_type' in fullStat ? fullStat.stat_type : 'resolution';
  const direction = 'stat_direction' in fullStat ? fullStat.stat_direction : null;
  const isResolution = statType === 'resolution';
  const isRetracted = 'retracted_at' in fullStat && !!fullStat.retracted_at;

  return (
    <div className="w-80 flex-shrink-0 flex flex-col border-l border-slate-800 bg-[#0c1322] overflow-y-auto">

      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-slate-800">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-400">Statement</p>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-600 hover:text-slate-400 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-4 py-4 space-y-5">

        {isRetracted && (
          <div className="rounded-lg border border-slate-600/30 bg-slate-700/20 px-3 py-2 text-xs text-slate-500">
            This statement has been retracted from the debate.
          </div>
        )}

        {/* Title */}
        <p className={`text-base font-semibold leading-snug ${isRetracted ? 'text-slate-500' : 'text-slate-100'}`}>
          {statement.stat_title}
        </p>

        {/* Type & Direction */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Type & Direction</p>
          <div className="flex flex-wrap gap-2">
            {isRetracted && (
              <span className="rounded px-2.5 py-1 text-xs font-bold border bg-slate-700/40 text-slate-500 border-slate-600/30">
                Retracted
              </span>
            )}
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

        {/* Voting */}
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
            <button
              disabled
              className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 text-sm font-semibold text-slate-500 cursor-not-allowed opacity-50"
            >
              Vote — coming soon
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
