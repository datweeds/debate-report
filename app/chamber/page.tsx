'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/AuthProvider';
import ControlBar          from '@/components/chamber/ControlBar';
import ListPanel            from '@/components/chamber/ListPanel';
import DetailPanel          from '@/components/chamber/DetailPanel';
import Switchboard          from '@/components/chamber/Switchboard';
import UpdateModal          from '@/components/chamber/UpdateModal';
import CreateStatementModal from '@/components/chamber/CreateStatementModal';
import type { ChamberData, FullStatement, Resolution } from '@/components/chamber/types';
import type { ChamberStatement, ChamberRelationship } from '@/components/chamber/ChamberGraph';

const ChamberGraph = dynamic(() => import('@/components/chamber/ChamberGraph'), { ssr: false });

// ── Chamber (uses search params) ──────────────────────────────────────────────

function ChamberInner() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const { user }      = useAuth();
  const resolutionParam = searchParams.get('resolution');

  // ── State
  const [data,           setData]           = useState<ChamberData | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');
  const [selectedId,     setSelectedId]     = useState<string | null>(null);
  const [showList,       setShowList]       = useState(true);
  const [showDetail,     setShowDetail]     = useState(true);
  const [showSwitchboard,setShowSwitchboard]= useState(!resolutionParam);
  const [showRetracted,  setShowRetracted]  = useState(false);
  const [updateTarget,   setUpdateTarget]   = useState<string | null>(null);
  const [createTarget,   setCreateTarget]   = useState<string | null>(null);

  // ── Load debate
  useEffect(() => {
    if (!resolutionParam) {
      setData(null);
      setSelectedId(null);
      setShowSwitchboard(true);
      return;
    }
    setLoading(true);
    setError('');
    setSelectedId(null);
    fetch(`/api/chamber/${resolutionParam}`)
      .then(r => {
        if (!r.ok) return r.json().then(d => Promise.reject(d.error ?? 'Not found'));
        return r.json();
      })
      .then((d: ChamberData) => setData(d))
      .catch(e => setError(typeof e === 'string' ? e : 'Could not load debate'))
      .finally(() => setLoading(false));
  }, [resolutionParam]);

  // ── Handlers

  // Click a node: toggle locked (action buttons stay visible). Also reveals detail panel.
  const handleNodeClick = useCallback((id: string) => {
    if (!id) { setSelectedId(null); return; }
    setSelectedId(prev => prev === id ? null : id);
    setShowDetail(true);
  }, []);

  const handleSelectDebate = useCallback((id: string) => {
    router.push(`/chamber?resolution=${id}`);
  }, [router]);

  // Retract: POST to API, cascade to dependents, update local state
  const handleRetractNode = useCallback(async (id: string) => {
    if (!window.confirm('Retract this statement? All statements that support it will also be retracted.')) return;
    try {
      const res = await fetch(`/api/statements/${id}/retract`, { method: 'POST' });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error ?? 'Retraction failed');
        return;
      }
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
    } catch {
      alert('Could not retract statement. Please try again.');
    }
  }, []);

  // Open update modal for a given node
  const handleUpdateNode = useCallback((id: string) => {
    setUpdateTarget(id);
  }, []);

  // Open create-child modal for a given node
  const handleCreateChild = useCallback((id: string) => {
    setCreateTarget(id);
  }, []);

  // Apply a newly created statement to local state.
  // The API returns extra fields (stat_description, created_at) that aren't in ChamberStatement;
  // cast to any to capture them cleanly.
  const handleStatementCreated = useCallback((
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    statement: any,
    relationship: ChamberRelationship,
  ) => {
    setData(prev => {
      if (!prev) return prev;
      const newFull: FullStatement = {
        id:              statement.id,
        stat_type:       statement.stat_type,
        stat_title:      statement.stat_title,
        stat_direction:  statement.stat_direction ?? null,
        retracted_at:    statement.retracted_at ?? null,
        created_by:      statement.created_by ?? null,
        stat_description: statement.stat_description ?? null,
        created_at:      statement.created_at ?? new Date().toISOString(),
        creator_handle:  user?.handle ?? null,
        agree_count:     0,
        disagree_count:  0,
      };
      return {
        ...prev,
        statements:    [...prev.statements, newFull],
        relationships: [...prev.relationships, relationship],
      };
    });
  }, [user]);

  // Apply saved changes from the update modal to local state
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

  // ── Derived state

  // Filter statements for the graph based on showRetracted toggle
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

  // Statement shown in the detail panel
  const selectedStatement = useMemo<FullStatement | Resolution | null>(() => {
    if (!selectedId || !data) return null;
    if (selectedId === data.resolution.id) return data.resolution;
    return data.statements.find(s => s.id === selectedId) ?? null;
  }, [selectedId, data]);

  // Data passed to the update modal
  const updateModalStatement = useMemo(() => {
    if (!updateTarget || !data) return null;
    if (updateTarget === data.resolution.id) return data.resolution;
    return data.statements.find(s => s.id === updateTarget) ?? null;
  }, [updateTarget, data]);

  // Whether a given statement has downstream connections (locks its title)
  const statementsWithChildren = useMemo(() => {
    const set = new Set(data?.relationships.map(r => r.stat_id_supported) ?? []);
    return set;
  }, [data]);

  // Data passed to the create modal
  const createModalParent = useMemo(() => {
    if (!createTarget || !data) return null;
    if (createTarget === data.resolution.id) {
      return { id: data.resolution.id, stat_type: 'resolution', stat_title: data.resolution.stat_title };
    }
    return data.statements.find(s => s.id === createTarget) ?? null;
  }, [createTarget, data]);

  // ── Render

  return (
    <>
      <div className="fixed inset-0 top-16 z-40 bg-[#080d1a] flex flex-col overflow-hidden">

        <ControlBar
          data={data}
          showList={showList}
          showDetail={showDetail}
          showRetracted={showRetracted}
          onToggleList={() => setShowList(v => !v)}
          onToggleDetail={() => setShowDetail(v => !v)}
          onToggleRetracted={() => setShowRetracted(v => !v)}
          onOpenSwitchboard={() => setShowSwitchboard(true)}
        />

        <div className="flex-1 flex overflow-hidden min-h-0">

          {showList && data && (
            <ListPanel
              resolution={data.resolution}
              statements={data.statements}
              selectedId={selectedId}
              onSelect={handleNodeClick}
            />
          )}

          {/* Graph */}
          <div className="flex-1 relative overflow-hidden min-w-0">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-slate-500 text-sm">Loading debate…</p>
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-red-400 text-sm mb-3">{error}</p>
                  <button onClick={() => setShowSwitchboard(true)} className="text-xs text-blue-400 hover:underline">
                    Choose a different debate →
                  </button>
                </div>
              </div>
            )}
            {!loading && !error && !data && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className="h-16 w-16 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <svg className="h-8 w-8 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                  </svg>
                </div>
                <p className="text-slate-400 text-sm">Select a debate to begin</p>
                <button
                  onClick={() => setShowSwitchboard(true)}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
                >
                  Open Switchboard
                </button>
              </div>
            )}
            {!loading && !error && data && (
              <ChamberGraph
                resolution={data.resolution}
                statements={graphStatements}
                relationships={graphRelationships}
                selectedId={selectedId}
                userId={user?.sub ?? null}
                onNodeClick={handleNodeClick}
                onUpdateNode={handleUpdateNode}
                onRetractNode={handleRetractNode}
                onCreateChild={handleCreateChild}
              />
            )}
          </div>

          {showDetail && selectedStatement && (
            <DetailPanel
              statement={selectedStatement}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      </div>

      {showSwitchboard && (
        <Switchboard
          currentId={resolutionParam}
          onSelect={handleSelectDebate}
          onClose={() => { if (data) setShowSwitchboard(false); }}
        />
      )}

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

      {createTarget && createModalParent && data && (
        <CreateStatementModal
          parentId={createModalParent.id}
          parentType={createModalParent.stat_type}
          parentTitle={createModalParent.stat_title}
          resolutionId={data.resolution.id}
          onCreated={handleStatementCreated}
          onClose={() => setCreateTarget(null)}
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
