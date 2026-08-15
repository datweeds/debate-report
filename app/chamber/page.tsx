'use client';

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/AuthProvider';
import ControlBar          from '@/components/chamber/ControlBar';
import ListPanel, { type StatMetrics } from '@/components/chamber/ListPanel';
import DetailPanel          from '@/components/chamber/DetailPanel';
import Switchboard          from '@/components/chamber/Switchboard';
import UpdateModal          from '@/components/chamber/UpdateModal';
import CreateStatementModal from '@/components/chamber/CreateStatementModal';
import AnalysisModal        from '@/components/chamber/AnalysisModal';
import FlagModal            from '@/components/chamber/FlagModal';
import FooterModals, { type FooterModal } from '@/components/FooterModals';
import ArgueModal    from '@/components/chamber/ArgueModal';
import ScienceModal  from '@/components/chamber/ScienceModal';
import type { ChamberData, FullStatement, Resolution } from '@/components/chamber/types';
import type { ChamberStatement, ChamberRelationship, ChamberGraphHandle } from '@/components/chamber/ChamberGraph';


const ChamberGraph = dynamic(() => import('@/components/chamber/ChamberGraph'), { ssr: false });

type RightPanel = { id: string; section?: 'chat' | 'vote'; sectionV: number } | null;

// ── Mobile list sheet ─────────────────────────────────────────────────────────

type MobileListSheetProps = {
  resolution: Resolution;
  statements: FullStatement[];
  selectedId: string | null;
  initialMetrics: boolean;
  metrics: StatMetrics[] | null;
  onSelect: (id: string) => void;
  onClose: () => void;
};

function MobileListSheet({ resolution, statements, selectedId, initialMetrics, metrics, onSelect, onClose }: MobileListSheetProps) {
  const [entered,     setEntered]     = useState(false);
  const [leaving,     setLeaving]     = useState(false);
  const [dragY,       setDragY]       = useState(0);
  const [dragging,    setDragging]    = useState(false);
  const [metricsMode, setMetricsMode] = useState(initialMetrics);
  const touchStartY = useRef(0);
  const dragYRef    = useRef(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function dismiss() {
    if (leaving) return;
    dragYRef.current = 0;
    setDragY(0);
    setDragging(false);
    setLeaving(true);
    setTimeout(onClose, 450);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
    dragYRef.current = 0;
    setDragging(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) { dragYRef.current = delta; setDragY(delta); }
  }

  function handleTouchEnd() {
    setDragging(false);
    if (dragYRef.current > 80) { dismiss(); } else { dragYRef.current = 0; setDragY(0); }
  }

  const translateY = leaving ? '100%' : entered ? `${dragY}px` : '100%';
  const transition = dragging ? 'none' : 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)';

  return (
    <div
      className="sm:hidden fixed inset-x-0 bottom-7 z-50 flex flex-col"
      style={{ height: '80vh', transform: `translateY(${translateY})`, transition }}
    >
      <div className="bg-[#080d1a] border-t border-slate-700 rounded-t-2xl flex flex-col h-full shadow-2xl overflow-hidden">
        {/* Drag handle row */}
        <div
          className="relative flex items-center justify-center px-4 py-3 border-b border-slate-800 flex-shrink-0"
          style={{ touchAction: 'none', userSelect: 'none' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 rounded-full bg-slate-600" />
          <button
            onClick={dismiss}
            className="absolute right-4 rounded-lg p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Scrollable content — overflow-x-auto enables horizontal scroll for metrics */}
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden" style={{ overscrollBehavior: 'none' }}>
          <ListPanel
            inline
            resolution={resolution}
            statements={statements}
            selectedId={selectedId}
            metricsMode={metricsMode}
            metrics={metrics}
            onSelect={id => { onSelect(id); dismiss(); }}
            onToggleMetrics={() => setMetricsMode(v => !v)}
          />
        </div>
      </div>
    </div>
  );
}

// ── Mobile bottom sheet ───────────────────────────────────────────────────────

type MobileDetailSheetProps = {
  statement: FullStatement | Resolution;
  user: ReturnType<typeof useAuth>['user'];
  rightPanel: RightPanel;
  flagRefreshSignal: number;
  canAnalyse: boolean;
  onClose: () => void;
  onMetricsRefresh: () => void;
  onOpenFlagModal: () => void;
  onAnalyse?: (id: string) => void;
};

function MobileDetailSheet({ statement, user, rightPanel, flagRefreshSignal, canAnalyse, onClose, onMetricsRefresh, onOpenFlagModal, onAnalyse }: MobileDetailSheetProps) {
  const [entered,  setEntered]  = useState(false);
  const [leaving,  setLeaving]  = useState(false);
  const [dragY,    setDragY]    = useState(0);
  const [dragging, setDragging] = useState(false);
  const touchStartY = useRef(0);
  const dragYRef    = useRef(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function dismiss() {
    if (leaving) return;
    dragYRef.current = 0;
    setDragY(0);
    setDragging(false);
    setLeaving(true);
    setTimeout(onClose, 450);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
    dragYRef.current = 0;
    setDragging(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      dragYRef.current = delta;
      setDragY(delta);
    }
  }

  function handleTouchEnd() {
    setDragging(false);
    if (dragYRef.current > 80) {
      dismiss();
    } else {
      dragYRef.current = 0;
      setDragY(0);
    }
  }

  const translateY = leaving ? '100%' : entered ? `${dragY}px` : '100%';
  const transition = dragging ? 'none' : 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)';

  return (
    <div
      className="sm:hidden fixed inset-x-0 bottom-7 z-50 flex flex-col"
      style={{ height: '72vh', transform: `translateY(${translateY})`, transition }}
    >
      <div className="bg-[#0c1322] border-t border-slate-700 rounded-t-2xl flex flex-col h-full shadow-2xl">
        {/* Drag handle row */}
        <div
          className="relative flex items-center justify-center px-4 py-3 border-b border-slate-800 flex-shrink-0"
          style={{ touchAction: 'none', userSelect: 'none' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 rounded-full bg-slate-600" />
          <button
            onClick={dismiss}
            className="absolute right-4 rounded-lg p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <DetailPanel
            statement={statement}
            userId={user?.sub ?? null}
            userHandle={user?.handle ?? null}
            userTier={user?.tier ?? null}
            openSection={rightPanel!.section}
            openSectionV={rightPanel!.sectionV}
            flagRefreshSignal={flagRefreshSignal}
            onClose={dismiss}
            onMetricsRefresh={onMetricsRefresh}
            onOpenFlagModal={onOpenFlagModal}
            onAnalyse={canAnalyse ? onAnalyse : undefined}
          />
        </div>
      </div>
    </div>
  );
}

// ── Chamber (uses search params) ──────────────────────────────────────────────

function ChamberInner() {
  const searchParams    = useSearchParams();
  const router          = useRouter();
  const { user }        = useAuth();
  const resolutionParam = searchParams.get('resolution');
  const statementParam  = searchParams.get('statement');
  const subjectParam    = searchParams.get('subject');
  const graphHandle = useRef<ChamberGraphHandle | null>(null);

  // ── State
  const [data,           setData]           = useState<ChamberData | null>(null);
  const [loading,        setLoading]        = useState(!!resolutionParam);
  const [error,          setError]          = useState('');
  const [selectedId,     setSelectedId]     = useState<string | null>(null);
  const [rightPanel,     setRightPanel]     = useState<RightPanel>(null);
  const [listStage,      setListStage]      = useState<0 | 1 | 2>(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 0 : 1
  );
  const [detailOpen,     setDetailOpen]     = useState(false);
  const [switchboardOpen, setSwitchboardOpen] = useState(false);
  // Switchboard shows whenever there's no loaded debate, OR when user explicitly opens it
  const showSwitchboard = !resolutionParam || switchboardOpen;
  const [showRetracted,  setShowRetracted]  = useState(false);
  const [metrics,        setMetrics]        = useState<StatMetrics[] | null>(null);
  const [isFavourite,    setIsFavourite]    = useState(false);
  const [showAnalysis,   setShowAnalysis]   = useState(false);
  const [descPopupId,    setDescPopupId]    = useState<string | null>(null);
  const [showFlagModal,  setShowFlagModal]  = useState(false);
  const [forum403,       setForum403]       = useState<{ forumVisibility: string; forumId: string } | null>(null);
  const [flagRefreshSignal, setFlagRefreshSignal] = useState(0);
  const [updateTarget,        setUpdateTarget]        = useState<string | null>(null);
  const [createTarget,        setCreateTarget]        = useState<string | null>(null);
  const [createTargetType,    setCreateTargetType]    = useState<string | null>(null);
  const [createTargetDirection, setCreateTargetDirection] = useState<'for' | 'against' | null | undefined>(undefined);
  const [footerModal,         setFooterModal]         = useState<FooterModal>(null);
  const [argueTargetId,       setArgueTargetId]       = useState<string | null>(null);
  const [analyseTargetId,     setAnalyseTargetId]     = useState<string | null>(null);
  const [listSheetOpen,       setListSheetOpen]       = useState(false);
  const [listSheetMetrics,    setListSheetMetrics]    = useState(false);

  // ── Load debate
  useEffect(() => {
    if (!resolutionParam) {
      setData(null); setSelectedId(null); setRightPanel(null); setDetailOpen(false);
      setMetrics(null); setIsFavourite(false); setShowAnalysis(false);
      setSwitchboardOpen(true);
      return;
    }
    setLoading(true); setError(''); setForum403(null);
    setSelectedId(null); setRightPanel(null); setDetailOpen(false);
    setMetrics(null); setIsFavourite(false);
    fetch(`/api/chamber/${resolutionParam}`)
      .then(async r => {
        const d = await r.json();
        if (r.status === 403 && d.forumVisibility) {
          setForum403({ forumVisibility: d.forumVisibility, forumId: d.forumId });
          return;
        }
        if (!r.ok) throw new Error(d.error ?? 'Not found');
        setData(d);
      })
      .catch(e => setError(typeof e === 'string' ? e : e?.message ?? 'Could not load debate'))
      .finally(() => setLoading(false));
  }, [resolutionParam]);

  // ── Always load metrics when debate is loaded
  useEffect(() => {
    if (!resolutionParam || !data) return;
    fetch(`/api/chamber/${resolutionParam}/metrics`)
      .then(r => r.json())
      .then(d => setMetrics(d.metrics ?? []))
      .catch(() => setMetrics([]));
  }, [resolutionParam, data]);

  // ── Auto-select statement from URL param once data is loaded
  useEffect(() => {
    if (!statementParam || !data) return;
    const exists = data.statements.some(s => s.id === statementParam) || data.resolution.id === statementParam;
    if (!exists) return;
    setSelectedId(statementParam);
    setRightPanel({ id: statementParam, sectionV: 0 });
    setDetailOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, statementParam]);

  // ── Stamp last viewed resolution (localStorage + DB for logged-in users)
  useEffect(() => {
    if (!resolutionParam || !data) return;
    try { localStorage.setItem('dr_last_resolution', resolutionParam); } catch { /* private mode */ }
    if (user) {
      void fetch('/api/user/last-resolution', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionId: resolutionParam }),
      });
    }
  }, [resolutionParam, data, user]);

  // ── Load favourite status for current user
  useEffect(() => {
    if (!resolutionParam || !user) { setIsFavourite(false); return; }
    fetch(`/api/statements/${resolutionParam}/favourite`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setIsFavourite(d.isFavourite); })
      .catch(() => {});
  }, [resolutionParam, user]);

  // ── Handlers

  const handleNodeClick = useCallback((id: string) => {
    if (!id) { setSelectedId(null); return; }
    setSelectedId(id);
    setRightPanel(prev => prev ? { ...prev, id } : { id, sectionV: 0 });
    setDetailOpen(true);
  }, []);

  const handleSelectDebate = useCallback((id: string) => {
    setSwitchboardOpen(false);
    router.push(`/chamber?resolution=${id}`);
  }, [router]);

  const handleRetractNode = useCallback(async (id: string) => {
    if (!window.confirm('Retract this statement? All statements that support it will also be retracted.')) return;
    try {
      const res = await fetch(`/api/statements/${id}/retract`, { method: 'POST' });
      if (!res.ok) { const d = await res.json(); alert(d.error ?? 'Retraction failed'); return; }
      const { retracted } = await res.json() as { retracted: string[] };
      const retractedSet = new Set(retracted);
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          statements: prev.statements.map(s =>
            retractedSet.has(s.id) ? { ...s, retracted_at: new Date().toISOString() } : s,
          ),
        };
      });
      setSelectedId(null);
    } catch { alert('Could not retract statement. Please try again.'); }
  }, []);

  const handleUpdateNode = useCallback((id: string) => { setUpdateTarget(id); }, []);

  const handleCreateChild = useCallback((id: string, type: string, direction: 'for' | 'against' | null) => {
    setCreateTarget(id);
    setCreateTargetType(type);
    setCreateTargetDirection(direction);
  }, []);

  const handleChat = useCallback((id: string) => {
    setSelectedId(id);
    setRightPanel(prev => ({ id, section: 'chat', sectionV: (prev?.sectionV ?? 0) + 1 }));
    setDetailOpen(true);
  }, []);

  const handleVote = useCallback((id: string) => {
    setSelectedId(id);
    setRightPanel(prev => ({ id, section: 'vote', sectionV: (prev?.sectionV ?? 0) + 1 }));
    setDetailOpen(true);
  }, []);

  const handleClosePanel = useCallback(() => {
    setRightPanel(null);
    setDetailOpen(false);
  }, []);

  const handleToggleMetrics = useCallback(() => {
    setListStage(prev => prev >= 2 ? 1 : 2);
  }, []);

  const handlePrint = useCallback(() => {
    graphHandle.current?.exportSVG(data?.resolution.stat_title ?? 'Debate Graph');
  }, [data]);

  const handleToggleFavourite = useCallback(async () => {
    if (!resolutionParam || !user) return;
    try {
      const res = await fetch(`/api/statements/${resolutionParam}/favourite`, { method: 'POST' });
      if (res.ok) {
        const d = await res.json();
        setIsFavourite(d.isFavourite);
      }
    } catch { /* silent */ }
  }, [resolutionParam, user]);

  const handleDescriptionPopup = useCallback((id: string) => {
    setDescPopupId(id);
  }, []);

  const handleArgue    = useCallback((id: string) => { setArgueTargetId(id); }, []);
  const handleAnalyse  = useCallback((id: string) => { setAnalyseTargetId(id); }, []);

  const refreshMetrics = useCallback(() => {
    if (!resolutionParam) return;
    fetch(`/api/chamber/${resolutionParam}/metrics`)
      .then(r => r.json())
      .then(d => setMetrics(d.metrics ?? []))
      .catch(() => {});
  }, [resolutionParam]);

  const handleStatementCreated = useCallback((
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    statement: any,
    relationship: ChamberRelationship,
  ) => {
    setData(prev => {
      if (!prev) return prev;
      const newFull: FullStatement = {
        id:               statement.id,
        stat_type:        statement.stat_type,
        stat_title:       statement.stat_title,
        stat_direction:   statement.stat_direction ?? null,
        retracted_at:     statement.retracted_at ?? null,
        created_by:       statement.created_by ?? null,
        stat_description: statement.stat_description ?? null,
        created_at:       statement.created_at ?? new Date().toISOString(),
        creator_handle:   user?.handle ?? null,
        agree_count:      0,
        disagree_count:   0,
      };
      return {
        ...prev,
        statements:    [...prev.statements, newFull],
        relationships: [...prev.relationships, relationship],
      };
    });
    // Refresh metrics
    if (resolutionParam) {
      fetch(`/api/chamber/${resolutionParam}/metrics`).then(r => r.json()).then(d => setMetrics(d.metrics ?? []));
    }
  }, [user, resolutionParam]);

  const handleRelationshipLinked = useCallback((rel: ChamberRelationship) => {
    setData(prev => {
      if (!prev) return prev;
      return { ...prev, relationships: [...prev.relationships, rel] };
    });
  }, []);

  const handleUpdateSave = useCallback((id: string, title: string, description: string | null) => {
    setData(prev => {
      if (!prev) return prev;
      if (id === prev.resolution.id) {
        return { ...prev, resolution: { ...prev.resolution, stat_title: title, stat_description: description } };
      }
      return {
        ...prev,
        statements: prev.statements.map(s =>
          s.id === id ? { ...s, stat_title: title, stat_description: description } : s,
        ),
      };
    });
  }, []);

  const canArgue   = user?.tier === 'debater' || user?.tier === 'moderator' || !!user?.isSysAdmin;
  const canAnalyse = user?.plan === 'paid' || !!user?.isSysAdmin;

  // ── Derived state

  const graphStatements = useMemo<FullStatement[]>(() => {
    if (!data) return [];
    return showRetracted ? data.statements : data.statements.filter(s => !s.retracted_at);
  }, [data, showRetracted]);

  const graphRelationships = useMemo(() => {
    if (!data) return [];
    const visibleIds = new Set([data.resolution.id, ...graphStatements.map(s => s.id)]);
    return data.relationships.filter(r =>
      visibleIds.has(r.stat_id_supported) && visibleIds.has(r.stat_id_supported_by)
    );
  }, [data, graphStatements]);

  const rightPanelStatement = useMemo<FullStatement | Resolution | null>(() => {
    if (!rightPanel || !data) return null;
    const id = rightPanel.id;
    if (id === data.resolution.id) return data.resolution;
    return data.statements.find(s => s.id === id) ?? null;
  }, [rightPanel, data]);

  const updateModalStatement = useMemo(() => {
    if (!updateTarget || !data) return null;
    if (updateTarget === data.resolution.id) return data.resolution;
    return data.statements.find(s => s.id === updateTarget) ?? null;
  }, [updateTarget, data]);

  const statementsWithChildren = useMemo(() => {
    return new Set(data?.relationships.map(r => r.stat_id_supported) ?? []);
  }, [data]);

  const createModalParent = useMemo(() => {
    if (!createTarget || !data) return null;
    if (createTarget === data.resolution.id) {
      return { id: data.resolution.id, stat_type: 'resolution', stat_title: data.resolution.stat_title };
    }
    return data.statements.find(s => s.id === createTarget) ?? null;
  }, [createTarget, data]);

  // Scale bar: resolution row in metrics
  const resMetrics = useMemo(() => metrics?.find(m => m.id === data?.resolution.id), [metrics, data]);
  const scaleFor     = resMetrics?.vote_total_for     ?? 0;
  const scaleAgainst = resMetrics?.vote_total_against ?? 0;

  // Flag count for selected statement (null if nothing selected or metrics not loaded)
  const selectedFlagCount = useMemo(() => {
    if (!selectedId || !metrics) return null;
    const m = metrics.find(m => m.id === selectedId);
    return m?.flag_count ?? null;
  }, [selectedId, metrics]);

  // Description popup statement
  const descPopupStatement = useMemo(() => {
    if (!descPopupId || !data) return null;
    if (descPopupId === data.resolution.id) return data.resolution;
    return data.statements.find(s => s.id === descPopupId) ?? null;
  }, [descPopupId, data]);

  // ── Render

  return (
    <>
      <div className="fixed inset-0 top-16 z-40 bg-[#080d1a] flex flex-col overflow-hidden" style={{ bottom: 28 }}>

        <ControlBar
          data={data}
          showRetracted={showRetracted}
          isFavourite={isFavourite}
          scaleFor={scaleFor}
          scaleAgainst={scaleAgainst}
          selectedFlagCount={selectedFlagCount}
          onToggleRetracted={() => setShowRetracted(v => !v)}
          onToggleFavourite={handleToggleFavourite}
          onOpenSwitchboard={() => setSwitchboardOpen(true)}
          onPrint={handlePrint}
          onOpenAnalysis={() => setShowAnalysis(true)}
          onFlag={() => setShowFlagModal(true)}
          onOpenListSheet={() => { setListSheetMetrics(false); setListSheetOpen(true); }}
          onOpenMetricsSheet={() => { setListSheetMetrics(true); setListSheetOpen(true); }}
          canAnalyse={canAnalyse}
        />

        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* Left strip + list panel */}
          <div className="flex flex-shrink-0">
            <div className={`relative w-6 bg-[#050a15] border-r border-slate-800 flex-shrink-0 ${listStage === 0 ? 'hidden sm:flex' : ''}`}>
              <button
                onClick={() => setListStage(prev => prev > 0 ? 0 : 1)}
                title={listStage > 0 ? 'Collapse list' : 'Expand list'}
                className="absolute inset-0 flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  {listStage > 0
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  }
                </svg>
              </button>
            </div>
            <div className={`overflow-hidden transition-all duration-300 ${
              listStage === 0 ? 'w-0' : listStage === 1 ? 'w-80' : 'w-[820px]'
            }`}>
              {data && (
                <ListPanel
                  resolution={data.resolution}
                  statements={graphStatements}
                  selectedId={selectedId}
                  metricsMode={listStage >= 2}
                  metrics={metrics}
                  onSelect={handleNodeClick}
                  onToggleMetrics={handleToggleMetrics}
                />
              )}
            </div>
          </div>

          {/* Graph */}
          <div className="flex-1 relative overflow-hidden min-w-0">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-slate-500 text-sm">Loading debate…</p>
              </div>
            )}
            {forum403 && (
              <div className="absolute inset-0 flex items-center justify-center px-6">
                <div className="text-center max-w-xs">
                  {forum403.forumVisibility === 'apply' ? (
                    <>
                      <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <svg className="h-6 w-6 text-amber-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                        </svg>
                      </div>
                      <p className="text-slate-200 font-semibold text-sm mb-1">Private forum — Apply to join</p>
                      <p className="text-slate-500 text-xs mb-4">This debate is in a private forum. Apply to join to participate.</p>
                      <button
                        onClick={() => {
                          // POST join request
                          fetch(`/api/forums/${forum403.forumId}/join-requests`, { method: 'POST' })
                            .then(r => r.json())
                            .then(() => setError('Your request to join has been submitted.'));
                          setForum403(null);
                        }}
                        className="rounded-xl bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-500 transition-colors mr-2"
                      >
                        Apply to join
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-violet-500/10 flex items-center justify-center">
                        <svg className="h-6 w-6 text-violet-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                        </svg>
                      </div>
                      <p className="text-slate-200 font-semibold text-sm mb-1">Private forum — Invite only</p>
                      <p className="text-slate-500 text-xs mb-4">This debate is in an invite-only forum. Ask the forum owner for an invitation link.</p>
                    </>
                  )}
                  <button onClick={() => { setForum403(null); setSwitchboardOpen(true); }} className="text-xs text-blue-400 hover:underline">
                    Choose a different debate →
                  </button>
                </div>
              </div>
            )}
            {error && !forum403 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-red-400 text-sm mb-3">{error}</p>
                  <button onClick={() => setSwitchboardOpen(true)} className="text-xs text-blue-400 hover:underline">
                    Choose a different debate →
                  </button>
                </div>
              </div>
            )}
            {!loading && !error && !forum403 && !data && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className="h-16 w-16 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <svg className="h-8 w-8 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                  </svg>
                </div>
                <p className="text-slate-400 text-sm">Select a debate to begin</p>
                <button
                  onClick={() => setSwitchboardOpen(true)}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
                >
                  Open Switchboard
                </button>
              </div>
            )}
            {!loading && !error && !forum403 && data && (
              <ChamberGraph
                onMounted={h => { graphHandle.current = h; }}
                resolution={data.resolution}
                statements={graphStatements}
                relationships={graphRelationships}
                selectedId={selectedId}
                userId={user?.sub ?? null}
                metrics={metrics}
                onNodeClick={handleNodeClick}
                onUpdateNode={handleUpdateNode}
                onRetractNode={handleRetractNode}
                onCreateChild={handleCreateChild}
                onChat={handleChat}
                onVote={handleVote}
                onDescriptionPopup={handleDescriptionPopup}
                canArgue={canArgue}
                onArgue={handleArgue}
                canAnalyse={canAnalyse}
                onAnalyse={handleAnalyse}
              />
            )}
          </div>

          {/* Detail panel — desktop right panel (sm+) */}
          <div className="hidden sm:flex flex-shrink-0">
            <div className={`overflow-hidden transition-all duration-300 ${
              detailOpen && rightPanelStatement ? 'w-96' : 'w-0'
            }`}>
              {rightPanelStatement && (
                <DetailPanel
                  statement={rightPanelStatement}
                  userId={user?.sub ?? null}
                  userHandle={user?.handle ?? null}
                  userTier={user?.tier ?? null}
                  openSection={rightPanel!.section}
                  openSectionV={rightPanel!.sectionV}
                  flagRefreshSignal={flagRefreshSignal}
                  onClose={handleClosePanel}
                  onMetricsRefresh={refreshMetrics}
                  onOpenFlagModal={() => setShowFlagModal(true)}
                  onAnalyse={canAnalyse ? handleAnalyse : undefined}
                />
              )}
            </div>
            {data && (
              <div className="relative w-6 bg-[#050a15] border-l border-slate-800 flex-shrink-0">
                <button
                  onClick={() => rightPanel && setDetailOpen(prev => !prev)}
                  disabled={!rightPanel}
                  title={detailOpen ? 'Collapse detail' : 'Expand detail'}
                  className="absolute inset-0 flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    {detailOpen
                      ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      : <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    }
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail panel — mobile bottom sheet */}
      {detailOpen && rightPanelStatement && (
        <MobileDetailSheet
          statement={rightPanelStatement}
          user={user}
          rightPanel={rightPanel}
          flagRefreshSignal={flagRefreshSignal}
          canAnalyse={canAnalyse}
          onClose={handleClosePanel}
          onMetricsRefresh={refreshMetrics}
          onOpenFlagModal={() => setShowFlagModal(true)}
          onAnalyse={canAnalyse ? handleAnalyse : undefined}
        />
      )}

      {/* List sheet — mobile */}
      {listSheetOpen && data && (
        <MobileListSheet
          resolution={data.resolution}
          statements={graphStatements}
          selectedId={selectedId}
          initialMetrics={listSheetMetrics}
          metrics={metrics}
          onSelect={handleNodeClick}
          onClose={() => setListSheetOpen(false)}
        />
      )}

      {/* Thin footer strip */}
      <div className="fixed bottom-0 left-0 right-0 z-40 h-7 border-t border-slate-800/60 bg-[#04060b] flex items-center justify-between px-4 text-xs text-slate-600">
        <span>© debate.report {new Date().getFullYear()}</span>
        <nav className="flex items-center gap-4">
          {(['about', 'contact', 'terms', 'privacy'] as FooterModal[]).map(k => (
            <button key={k!} onClick={() => setFooterModal(k)} className="hover:text-slate-400 transition-colors capitalize">
              {k === 'terms' ? 'Terms' : k === 'privacy' ? 'Privacy' : k === 'contact' ? 'Contact' : 'About'}
            </button>
          ))}
        </nav>
      </div>

      <FooterModals modal={footerModal} onClose={() => setFooterModal(null)} />

      {showSwitchboard && (
        <Switchboard
          currentId={resolutionParam}
          onSelect={handleSelectDebate}
          onClose={() => resolutionParam ? setSwitchboardOpen(false) : router.push('/')}
          initialTopic={subjectParam ?? undefined}
        />
      )}

      {showAnalysis && data && (
        <AnalysisModal
          resolutionId={data.resolution.id}
          resolutionTitle={data.resolution.stat_title}
          onClose={() => setShowAnalysis(false)}
        />
      )}

      {showFlagModal && selectedId && rightPanelStatement && (
        <FlagModal
          statementId={selectedId}
          statementTitle={rightPanelStatement.stat_title}
          onClose={() => setShowFlagModal(false)}
          onFlagChanged={() => {
            refreshMetrics();
            setFlagRefreshSignal(s => s + 1);
          }}
        />
      )}

      {/* Description popup */}
      {descPopupId && descPopupStatement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" onClick={() => setDescPopupId(null)} />
          <div className="relative z-10 w-full max-w-xl rounded-2xl border border-slate-700 bg-[#0c1322] shadow-2xl flex flex-col overflow-hidden max-h-[80vh]">
            <div className="flex items-start justify-between px-5 py-4 border-b border-slate-800 flex-shrink-0">
              <div className="min-w-0 pr-4">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-1">Description</p>
                <h3 className="text-sm font-semibold text-slate-100 leading-snug">{descPopupStatement.stat_title}</h3>
              </div>
              <button onClick={() => setDescPopupId(null)} className="flex-shrink-0 rounded-lg p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {descPopupStatement.stat_description ? (
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {descPopupStatement.stat_description}
                </p>
              ) : (
                <p className="text-sm text-slate-500 italic">No description provided.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {argueTargetId && data && (() => {
        const argueStmt = argueTargetId === data.resolution.id
          ? data.resolution
          : (data.statements.find(s => s.id === argueTargetId) ?? null);
        return argueStmt ? (
          <ArgueModal
            statement={argueStmt}
            resolution={data.resolution}
            onClose={() => setArgueTargetId(null)}
            onStatementsCreated={() => {
              refreshMetrics();
              if (resolutionParam) {
                fetch(`/api/chamber/${resolutionParam}`)
                  .then(r => r.ok ? r.json() : null)
                  .then((d: ChamberData | null) => { if (d) setData(d); })
                  .catch(() => {});
              }
            }}
          />
        ) : null;
      })()}

      {analyseTargetId && data && (() => {
        const analyseStmt = analyseTargetId === data.resolution.id
          ? data.resolution
          : (data.statements.find(s => s.id === analyseTargetId) ?? null);
        return analyseStmt ? (
          <ScienceModal
            statement={analyseStmt}
            onClose={() => setAnalyseTargetId(null)}
            onAnalysisComplete={refreshMetrics}
          />
        ) : null;
      })()}

      {updateTarget && updateModalStatement && (
        <UpdateModal
          statementId={updateTarget}
          initialTitle={updateModalStatement.stat_title}
          initialDescription={updateModalStatement.stat_description}
          hasChildren={statementsWithChildren.has(updateTarget)}
          onSave={handleUpdateSave}
          onClose={() => setUpdateTarget(null)}
        />
      )}

      {createTarget && createTargetType && createTargetDirection !== undefined && createModalParent && data && (
        <CreateStatementModal
          parentId={createModalParent.id}
          parentType={createModalParent.stat_type}
          parentTitle={createModalParent.stat_title}
          resolutionId={data.resolution.id}
          preSelectedType={createTargetType}
          preSelectedDirection={createTargetDirection}
          availableStatements={data.statements}
          onCreated={handleStatementCreated}
          onRelationshipLinked={handleRelationshipLinked}
          onClose={() => { setCreateTarget(null); setCreateTargetType(null); setCreateTargetDirection(undefined); }}
        />
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChamberPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 top-16 z-40 bg-[#080d1a] flex items-center justify-center">
        <p className="text-slate-500 text-sm">Loading chamber…</p>
      </div>
    }>
      <ChamberInner />
    </Suspense>
  );
}
