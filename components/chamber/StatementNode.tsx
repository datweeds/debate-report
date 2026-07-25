'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export type StatementNodeData = {
  label: string;
  statType: 'resolution' | 'claim' | 'warrant' | 'evidence' | 'rebuttal';
  direction: 'for' | 'against' | null;
};

const TYPE_CFG = {
  resolution: { badge: 'Resolution', cls: 'bg-amber-400/20 text-amber-200 border-amber-500/40' },
  claim:      { badge: 'Claim',      cls: 'bg-slate-500/40 text-slate-200 border-slate-400/30' },
  warrant:    { badge: 'Warrant',    cls: 'bg-violet-500/20 text-violet-200 border-violet-500/40' },
  evidence:   { badge: 'Evidence',   cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40' },
  rebuttal:   { badge: 'Rebuttal',   cls: 'bg-rose-500/20 text-rose-200 border-rose-500/40' },
} as const;

function StatementNode({ data, selected }: NodeProps & { data: StatementNodeData }) {
  const cfg = TYPE_CFG[data.statType] ?? TYPE_CFG.claim;
  const isResolution = data.statType === 'resolution';

  return (
    <>
      {!isResolution && (
        <Handle type="target" position={Position.Top}
          className="!bg-slate-600 !border-slate-500" style={{ width: 8, height: 8 }} />
      )}

      <div
        style={{ width: 210, minHeight: 88, padding: '10px 12px' }}
        className={`rounded-xl border-2 shadow-xl transition-all ${
          isResolution ? 'bg-slate-800' : 'bg-[#0c1322]'
        } ${
          selected
            ? 'border-blue-400 shadow-blue-500/20'
            : isResolution
            ? 'border-blue-600/60'
            : 'border-slate-700/80'
        }`}
      >
        <p className="text-[11px] leading-snug text-slate-100 font-medium line-clamp-3 mb-2.5">
          {data.label}
        </p>
        <div className="flex flex-wrap gap-1">
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold border ${cfg.cls}`}>
            {cfg.badge}
          </span>
          {data.direction && (
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold border ${
              data.direction === 'for'
                ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
                : 'bg-rose-500/20 text-rose-200 border-rose-500/40'
            }`}>
              {data.direction === 'for' ? 'For' : 'Against'}
            </span>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom}
        className="!bg-slate-600 !border-slate-500" style={{ width: 8, height: 8 }} />
    </>
  );
}

export default memo(StatementNode);
