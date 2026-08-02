'use client';

import { memo, useState, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export type StatType =
  | 'resolution' | 'framework' | 'claim' | 'warrant'
  | 'evidence'   | 'impact'    | 'rebuttal' | 'turn';

export type StatementNodeData = {
  label: string;
  statType: StatType;
  direction: 'for' | 'against' | null;
  isRetracted: boolean;
  // Owner / role flags
  isOwner: boolean;
  hasChildren: boolean;   // title cannot be changed if true
  canCreate: boolean;     // user is logged in (can add child statements)
  allowedChildren: string[];
  // Callbacks
  onUpdate: (id: string) => void;
  onRetract: (id: string) => void;
  onCreateChild: (id: string) => void;
};

// Visual dimensions — ELK uses TOTAL_H for layout spacing
export const NODE_W  = 230;
export const NODE_H  = 110;
export const BTN_H   = 38;
export const TOTAL_H = NODE_H + BTN_H;

const TYPE_CFG: Record<StatType, { badge: string; cls: string }> = {
  resolution: { badge: 'Resolution', cls: 'bg-amber-400/20 text-amber-200 border-amber-500/40' },
  framework:  { badge: 'Framework',  cls: 'bg-sky-500/20 text-sky-200 border-sky-500/40' },
  claim:      { badge: 'Claim',      cls: 'bg-slate-500/40 text-slate-200 border-slate-400/30' },
  warrant:    { badge: 'Warrant',    cls: 'bg-violet-500/20 text-violet-200 border-violet-500/40' },
  evidence:   { badge: 'Evidence',   cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40' },
  impact:     { badge: 'Impact',     cls: 'bg-orange-500/20 text-orange-200 border-orange-500/40' },
  rebuttal:   { badge: 'Rebuttal',   cls: 'bg-rose-500/20 text-rose-200 border-rose-500/40' },
  turn:       { badge: 'Turn',       cls: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/40' },
};

function StatementNode({ id, data, selected }: NodeProps & { data: StatementNodeData }) {
  const [hovered, setHovered] = useState(false);

  const cfg = TYPE_CFG[data.statType] ?? TYPE_CFG.claim;
  const isResolution = data.statType === 'resolution';

  // Owner actions: Update always; Retract only for non-resolution, non-retracted
  const showOwnerActions  = !data.isRetracted && data.isOwner;
  const canRetract        = showOwnerActions && !isResolution;
  // Create action: any logged-in user, if allowed children exist and not retracted
  const showCreateAction  = !data.isRetracted && data.canCreate && data.allowedChildren.length > 0;
  // Button strip visible when hovered or locked (selected)
  const buttonVisible     = (hovered || selected) && (showOwnerActions || showCreateAction);

  const handleUpdate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    data.onUpdate(id);
  }, [id, data]);

  const handleRetract = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    data.onRetract(id);
  }, [id, data]);

  const handleCreateChild = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    data.onCreateChild(id);
  }, [id, data]);

  return (
    <>
      {!isResolution && (
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-slate-600 !border-slate-500"
          style={{ width: 8, height: 8 }}
        />
      )}

      {/* Outer wrapper: full TOTAL_H keeps hover zone contiguous with button strip */}
      <div
        style={{ width: NODE_W, height: TOTAL_H }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* ── Visible node box ── */}
        <div
          style={{ height: NODE_H, padding: '12px 14px' }}
          className={`rounded-xl border-2 shadow-xl transition-all ${
            data.isRetracted
              ? 'bg-slate-800/30 border-slate-600/30'
              : isResolution
              ? 'bg-slate-800'
              : 'bg-[#0c1322]'
          } ${
            !data.isRetracted && selected
              ? 'border-blue-400 shadow-blue-500/20'
              : !data.isRetracted && isResolution
              ? 'border-blue-600/60'
              : !data.isRetracted
              ? 'border-slate-700/80'
              : ''
          }`}
        >
          <p className={`text-sm leading-snug font-medium line-clamp-3 mb-2.5 ${
            data.isRetracted ? 'text-slate-500' : 'text-slate-100'
          }`}>
            {data.label}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.isRetracted ? (
              <span className="rounded px-2 py-0.5 text-[11px] font-bold border bg-slate-700/40 text-slate-500 border-slate-600/30">
                Retracted
              </span>
            ) : (
              <>
                <span className={`rounded px-2 py-0.5 text-[11px] font-bold border ${cfg.cls}`}>
                  {cfg.badge}
                </span>
                {data.direction && (
                  <span className={`rounded px-2 py-0.5 text-[11px] font-bold border ${
                    data.direction === 'for'
                      ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
                      : 'bg-rose-500/20 text-rose-200 border-rose-500/40'
                  }`}>
                    {data.direction === 'for' ? 'For' : 'Against'}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Action button strip ── opacity-toggled, always in DOM for hover zone */}
        <div
          style={{ height: BTN_H }}
          className={`flex items-center justify-between px-1 pt-1 gap-1 transition-opacity duration-150 ${
            buttonVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Owner actions (left) */}
          <div className="flex gap-1.5">
            {showOwnerActions && (
              <button
                onClick={handleUpdate}
                className="flex items-center gap-1 rounded-lg bg-blue-600/90 px-2.5 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-blue-500 active:scale-95 transition-all"
              >
                <svg className="h-3 w-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                </svg>
                Update
              </button>
            )}
            {canRetract && (
              <button
                onClick={handleRetract}
                className="flex items-center gap-1 rounded-lg bg-rose-600/90 px-2.5 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-rose-500 active:scale-95 transition-all"
              >
                <svg className="h-3 w-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Retract
              </button>
            )}
          </div>

          {/* Create action (right) */}
          {showCreateAction && (
            <button
              onClick={handleCreateChild}
              className="flex items-center gap-1 rounded-lg bg-emerald-600/90 px-2.5 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-emerald-500 active:scale-95 transition-all"
            >
              <svg className="h-3 w-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add
            </button>
          )}
        </div>
      </div>

      {/* Source handle at the bottom of the VISIBLE node box (not button strip) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-600 !border-slate-500"
        style={{ width: 8, height: 8, bottom: BTN_H }}
      />
    </>
  );
}

export default memo(StatementNode);
