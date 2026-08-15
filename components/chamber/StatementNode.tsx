'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { STAT_BADGE, STAT_LABEL } from './constants';

export type StatType =
  | 'resolution' | 'framework' | 'claim' | 'warrant'
  | 'evidence'   | 'impact'    | 'rebuttal' | 'turn';

export type StatementNodeData = {
  label: string;
  statType: StatType;
  direction: 'for' | 'against' | null;
  isRetracted: boolean;
  isOwner: boolean;
  hasChildren: boolean;
  canCreate: boolean;
  allowedChildren: string[];
  description: string | null;
  agreeCount: number;
  disagreeCount: number;
  totalFor: number;
  totalAgainst: number;
  chatCount: number;
  hasAnalysis: boolean;
  isFlagged: boolean;
  onUpdate: (id: string) => void;
  onRetract: (id: string) => void;
  onCreateChild: (id: string, type: string, direction: 'for' | 'against' | null) => void;
  onChat: (id: string) => void;
  onVote: (id: string) => void;
  onDescriptionPopup: (id: string) => void;
  onArgue?:   (id: string) => void;
  onAnalyse?: (id: string) => void;
};

export const NODE_W = 260;
export const BTN_H  = 40;

const CHARS_PER_LINE = 30;
const LINE_H         = 20;
const BASE_H         = 72;
const MAX_LINES      = 4;

export function computeNodeH(label: string): number {
  const lineCount = Math.min(MAX_LINES, Math.max(1, Math.ceil(label.length / CHARS_PER_LINE)));
  return BASE_H + lineCount * LINE_H;
}

// ── Direction auto-computation ────────────────────────────────────────────────

function autoDirection(
  type: string,
  parentDir: 'for' | 'against' | null,
): { auto: true; direction: 'for' | 'against' | null } | { auto: false } {
  switch (type) {
    case 'framework':
      return { auto: true, direction: 'for' };
    case 'evidence':
      return { auto: true, direction: null };
    case 'warrant':
    case 'impact':
      return { auto: true, direction: parentDir };
    case 'rebuttal':
    case 'turn':
      if (parentDir === null) return { auto: true, direction: null };
      return { auto: true, direction: parentDir === 'for' ? 'against' : 'for' };
    default:
      return { auto: false };
  }
}

// ── Sub-panels ────────────────────────────────────────────────────────────────

function TypePickerPanel({
  types, onPick, onCancel,
}: {
  types: string[];
  onPick: (t: string) => void;
  onCancel?: () => void;
}) {
  return (
    <div className="bg-[#0c1322] border border-slate-600 rounded-xl p-2 shadow-2xl" style={{ minWidth: 160 }}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 px-0.5">
        Statement type
      </p>
      <div className="grid grid-cols-2 gap-1">
        {types.map(type => (
          <button
            key={type}
            onClick={e => { e.stopPropagation(); onPick(type); }}
            className={`rounded-lg border px-2 py-1.5 text-[10px] font-bold text-left transition-all hover:brightness-125 active:scale-95 ${
              STAT_BADGE[type] ?? 'bg-slate-700 text-slate-200 border-slate-600'
            }`}
          >
            {STAT_LABEL[type] ?? type}
          </button>
        ))}
      </div>
      {onCancel && (
        <button
          onClick={e => { e.stopPropagation(); onCancel(); }}
          className="mt-1.5 w-full text-center text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
        >
          cancel
        </button>
      )}
    </div>
  );
}

function DirectionPickerPanel({
  type, onPick, onBack, onCancel,
}: {
  type: string;
  onPick: (d: 'for' | 'against') => void;
  onBack: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="bg-[#0c1322] border border-slate-600 rounded-xl p-2 shadow-2xl" style={{ minWidth: 170 }}>
      <div className="flex items-center gap-1.5 mb-2 px-0.5">
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${
          STAT_BADGE[type] ?? 'bg-slate-700 text-slate-200 border-slate-600'
        }`}>
          {STAT_LABEL[type] ?? type}
        </span>
        <span className="text-[10px] text-slate-500">›</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Direction</span>
      </div>

      <div className="flex flex-col gap-1">
        <button
          onClick={e => { e.stopPropagation(); onPick('for'); }}
          className="rounded-lg border border-blue-500/40 bg-blue-500/20 text-blue-200 px-2 py-2 text-[10px] font-bold text-left hover:brightness-125 active:scale-95 transition-all"
        >
          For the resolution
        </button>
        <button
          onClick={e => { e.stopPropagation(); onPick('against'); }}
          className="rounded-lg border border-rose-500/40 bg-rose-500/20 text-rose-200 px-2 py-2 text-[10px] font-bold text-left hover:brightness-125 active:scale-95 transition-all"
        >
          Against the resolution
        </button>
      </div>

      <div className="flex justify-between mt-1.5">
        <button
          onClick={e => { e.stopPropagation(); onBack(); }}
          className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
        >
          ← back
        </button>
        <button
          onClick={e => { e.stopPropagation(); onCancel(); }}
          className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
        >
          cancel
        </button>
      </div>
    </div>
  );
}

// ── Main node component ───────────────────────────────────────────────────────

function StatementNode({ id, data, selected }: NodeProps & { data: StatementNodeData }) {
  const { updateNode } = useReactFlow();
  const isResolution = data.statType === 'resolution';
  const nodeH        = computeNodeH(data.label);
  const totalH       = nodeH + BTN_H;

  const showOwnerActions = !data.isRetracted && data.isOwner;
  const canRetract       = showOwnerActions && !isResolution;
  const showCreateAction = !data.isRetracted && data.canCreate && data.allowedChildren.length > 0;
  const showChatVote     = data.canCreate;
  const showArgue        = !!data.onArgue && !data.isRetracted;
  const showAnalyse      = !!data.onAnalyse && !data.isRetracted;
  const hasButtons       = showOwnerActions || showCreateAction || showChatVote || showArgue || showAnalyse;

  type LockedStep = null | 'type' | 'direction';
  const [lockedStep,    setLockedStep]   = useState<LockedStep>(null);
  const [pickedType,    setPickedType]   = useState<string | null>(null);
  const [tooltipOpen,   setTooltipOpen]  = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!selected) { setLockedStep(null); setPickedType(null); }
  }, [selected]);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const hasLongTitle = data.label.length > CHARS_PER_LINE * MAX_LINES;
  const hasTooltip   = !!data.description || hasLongTitle;

  const openTooltip  = useCallback(() => {
    if (!hasTooltip) return;
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setTooltipOpen(true);
    updateNode(id, { zIndex: 9999 });
  }, [hasTooltip, id, updateNode]);

  const closeTooltip = useCallback(() => {
    closeTimerRef.current = setTimeout(() => {
      setTooltipOpen(false);
      updateNode(id, { zIndex: 1 });
    }, 80);
  }, [id, updateNode]);

  const closePicker = useCallback(() => {
    setLockedStep(null);
    setPickedType(null);
  }, []);

  const handleTypePicked = useCallback((type: string) => {
    const result = autoDirection(type, data.direction);
    if (result.auto) {
      closePicker();
      data.onCreateChild(id, type, result.direction);
    } else {
      setPickedType(type);
      setLockedStep('direction');
    }
  }, [id, data, closePicker]);

  const handleDirectionPicked = useCallback((dir: 'for' | 'against') => {
    const type = pickedType!;
    closePicker();
    data.onCreateChild(id, type, dir);
  }, [id, data, pickedType, closePicker]);

  const handleAddClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (lockedStep !== null) closePicker();
    else setLockedStep('type');
  }, [lockedStep, closePicker]);

  const handleUpdate     = useCallback((e: React.MouseEvent) => { e.stopPropagation(); data.onUpdate(id); }, [id, data]);
  const handleRetract    = useCallback((e: React.MouseEvent) => { e.stopPropagation(); data.onRetract(id); }, [id, data]);
  const handleChat       = useCallback((e: React.MouseEvent) => { e.stopPropagation(); data.onChat(id); }, [id, data]);
  const handleVote       = useCallback((e: React.MouseEvent) => { e.stopPropagation(); data.onVote(id); }, [id, data]);
  const handleArgue      = useCallback((e: React.MouseEvent) => { e.stopPropagation(); data.onArgue?.(id); }, [id, data]);
  const handleAnalyse    = useCallback((e: React.MouseEvent) => { e.stopPropagation(); data.onAnalyse?.(id); }, [id, data]);
  const handleDescPopup  = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    data.onDescriptionPopup(id);
  }, [id, data]);

  const stripCls = !hasButtons
    ? 'opacity-0 pointer-events-none'
    : selected || lockedStep !== null
    ? 'opacity-100'
    : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto';

  const totalVotes = data.agreeCount + data.disagreeCount;
  const hasMetrics = totalVotes > 0 || data.totalFor > 0 || data.totalAgainst > 0 || data.chatCount > 0;

  // Node background based on direction
  const nodeBg = data.isRetracted ? 'bg-slate-600/40'
    : isResolution ? 'bg-slate-800'
    : data.direction === 'for' ? 'bg-[#071810]'
    : data.direction === 'against' ? 'bg-[#180a0a]'
    : 'bg-[#0c1322]';

  // Border based on selection + direction
  const nodeBorder = data.isRetracted ? 'border-slate-500/50'
    : selected
    ? data.direction === 'for' ? 'border-emerald-400 shadow-emerald-500/20'
      : data.direction === 'against' ? 'border-rose-400 shadow-rose-500/20'
      : 'border-blue-400 shadow-blue-500/20'
    : isResolution ? 'border-blue-600/60'
    : data.direction === 'for' ? 'border-emerald-700/50'
    : data.direction === 'against' ? 'border-rose-700/50'
    : 'border-slate-700/80';

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

      <div
        style={{ width: NODE_W, height: totalH }}
        className={`relative ${hasButtons ? 'group' : ''}`}
      >
        {/* ── Hover tooltip: full title + description (JS-driven hover relay) ── */}
        {hasTooltip && tooltipOpen && (
          <div
            className="absolute bottom-full left-0 right-0 pb-1.5 z-[300]"
            onMouseEnter={openTooltip}
            onMouseLeave={closeTooltip}
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-[#0c1322] border border-slate-600/80 rounded-xl p-3 shadow-2xl">
              <p className="text-[11px] text-slate-100 font-medium leading-snug">
                {data.label}
              </p>
              {data.description && (
                <>
                  <div className="border-t border-slate-700/50 my-2" />
                  <p className="text-[11px] text-slate-400 line-clamp-5 leading-relaxed">
                    {data.description}
                  </p>
                  <button
                    onClick={handleDescPopup}
                    className="mt-1.5 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Read more…
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Visible node box ── */}
        <div
          style={{ height: nodeH, padding: '10px 12px' }}
          className={`rounded-xl border-2 shadow-xl transition-all ${nodeBg} ${nodeBorder}`}
          onMouseEnter={openTooltip}
          onMouseLeave={closeTooltip}
        >
          <p className={`text-sm leading-snug font-medium mb-2 line-clamp-4 ${
            data.isRetracted ? 'text-slate-500 line-through decoration-slate-500' : 'text-slate-100'
          }`}>
            {data.label}
          </p>

          {/* Type + direction badges + metrics on one row */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {data.isRetracted ? (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-bold border bg-slate-700/40 text-slate-500 border-slate-600/30">
                Retracted
              </span>
            ) : (
              <>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${
                  STAT_BADGE[data.statType] ?? 'bg-slate-500/30 text-slate-200 border-slate-400/30'
                }`}>
                  {STAT_LABEL[data.statType] ?? data.statType}
                </span>
                {data.direction && (
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${
                    data.direction === 'for'
                      ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
                      : 'bg-rose-500/20 text-rose-200 border-rose-500/40'
                  }`}>
                    {data.direction === 'for' ? 'For' : 'Against'}
                  </span>
                )}
                {data.hasAnalysis && (
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold border bg-emerald-500/20 text-emerald-300 border-emerald-500/40" title="Science analysis available">
                    Sci ✓
                  </span>
                )}
                {data.isFlagged && (
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold border bg-red-600/30 text-red-300 border-red-500/50" title="This statement has been flagged">
                    🚩 Flagged
                  </span>
                )}

                {/* Inline metrics */}
                {hasMetrics && (
                  <>
                    {totalVotes > 0 && (
                      <>
                        <span className="text-slate-600 text-[10px]">·</span>
                        <span className="text-emerald-400 font-mono text-[10px]">✓{data.agreeCount}</span>
                        <span className="text-rose-400 font-mono text-[10px]">✗{data.disagreeCount}</span>
                      </>
                    )}
                    {(data.totalFor > 0 || data.totalAgainst > 0) && (
                      <>
                        <span className="text-slate-600 text-[10px]">·</span>
                        <span className="text-blue-300 font-mono text-[10px]">F:{data.totalFor}</span>
                        <span className="text-orange-300 font-mono text-[10px]">A:{data.totalAgainst}</span>
                      </>
                    )}
                    {data.chatCount > 0 && (
                      <>
                        <span className="text-slate-600 text-[10px]">·</span>
                        <span className="text-violet-300 font-mono text-[10px]">💬{data.chatCount}</span>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Action button strip ── */}
        <div
          style={{ height: BTN_H }}
          className={`flex items-center justify-between px-1 pt-1 gap-1 transition-opacity duration-150 ${stripCls}`}
        >
          <div className="flex gap-1">
            {showOwnerActions && (
              <button
                onClick={handleUpdate}
                title="Update"
                className="flex items-center gap-1 rounded-lg bg-blue-600/90 px-2 py-1.5 text-[11px] font-semibold text-white shadow-md hover:bg-blue-500 active:scale-95 transition-all"
              >
                <svg className="h-3 w-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                </svg>
                Edit
              </button>
            )}
            {canRetract && (
              <button
                onClick={handleRetract}
                title="Retract"
                className="flex items-center gap-1 rounded-lg bg-rose-600/90 px-2 py-1.5 text-[11px] font-semibold text-white shadow-md hover:bg-rose-500 active:scale-95 transition-all"
              >
                <svg className="h-3 w-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Retract
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            {showChatVote && (
              <button
                onClick={handleChat}
                title="Chat"
                className="flex items-center justify-center rounded-lg bg-violet-600/80 p-1.5 shadow-md hover:bg-violet-500 active:scale-95 transition-all"
              >
                <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                </svg>
              </button>
            )}

            {showChatVote && (
              <button
                onClick={handleVote}
                title="Vote"
                className="flex items-center justify-center rounded-lg bg-amber-600/80 p-1.5 shadow-md hover:bg-amber-500 active:scale-95 transition-all"
              >
                <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.253m0 0a2.25 2.25 0 0 1-2.25-2.25v-4a2.25 2.25 0 0 1 2.25-2.25h.254" />
                </svg>
              </button>
            )}

            {showArgue && (
              <button
                onClick={handleArgue}
                title="Argument Assistant"
                className="flex items-center justify-center rounded-lg bg-fuchsia-600/80 p-1.5 shadow-md hover:bg-fuchsia-500 active:scale-95 transition-all"
              >
                <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                </svg>
              </button>
            )}

            {showAnalyse && (
              <button
                onClick={handleAnalyse}
                title="Scientific Analysis"
                className="flex items-center justify-center rounded-lg bg-teal-600/80 p-1.5 shadow-md hover:bg-teal-500 active:scale-95 transition-all"
              >
                <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15a2.25 2.25 0 0 1 .45 1.32v.74c0 .513.416.929.93.929h.12a.93.93 0 0 0 .93-.93v-.74A2.25 2.25 0 0 1 21.68 15M19.8 15H4.2" />
                </svg>
              </button>
            )}

            {showCreateAction && (
              <div className="group/add relative shrink-0">
                <button
                  onClick={handleAddClick}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white shadow-md active:scale-95 transition-all ${
                    lockedStep !== null ? 'bg-slate-900' : 'bg-slate-900 hover:bg-slate-800 border border-slate-600'
                  }`}
                >
                  <svg className="h-3 w-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add
                </button>

                {lockedStep === null && (
                  <div className="absolute right-0 top-full z-[200] hidden group-hover/add:block">
                    <div className="pt-1">
                      <TypePickerPanel types={data.allowedChildren} onPick={handleTypePicked} />
                    </div>
                  </div>
                )}

                {lockedStep === 'type' && (
                  <div className="absolute right-0 top-full z-[200]">
                    <div className="pt-1">
                      <TypePickerPanel
                        types={data.allowedChildren}
                        onPick={handleTypePicked}
                        onCancel={closePicker}
                      />
                    </div>
                  </div>
                )}

                {lockedStep === 'direction' && pickedType && (
                  <div className="absolute right-0 top-full z-[200]">
                    <div className="pt-1">
                      <DirectionPickerPanel
                        type={pickedType}
                        onPick={handleDirectionPicked}
                        onBack={() => { setPickedType(null); setLockedStep('type'); }}
                        onCancel={closePicker}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

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
