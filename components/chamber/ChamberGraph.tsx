'use client';

import { useEffect, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import StatementNode, { type StatementNodeData, NODE_W, TOTAL_H } from './StatementNode';
import { PF_ALLOWED_CHILDREN } from './constants';

const nodeTypes = { statement: StatementNode };

export type ChamberStatement = {
  id: string;
  stat_type: string;
  stat_title: string;
  stat_direction: string | null;
  retracted_at: string | null;
  created_by: string | null;
};

export type ChamberRelationship = {
  stat_id_supported: string;
  stat_id_supported_by: string;
};

type Props = {
  resolution: { id: string; stat_title: string; created_by: string | null };
  statements: ChamberStatement[];
  relationships: ChamberRelationship[];
  selectedId: string | null;
  userId: string | null;
  onNodeClick: (id: string) => void;
  onUpdateNode: (id: string) => void;
  onRetractNode: (id: string) => void;
  onCreateChild: (parentId: string) => void;
};

function buildGraph(
  resolution: { id: string; stat_title: string; created_by: string | null },
  statements: ChamberStatement[],
  relationships: ChamberRelationship[],
): { nodes: Node<StatementNodeData>[]; edges: Edge[] } {
  const all: ChamberStatement[] = [
    {
      id: resolution.id, stat_type: 'resolution', stat_title: resolution.stat_title,
      stat_direction: null, retracted_at: null, created_by: resolution.created_by,
    },
    ...statements,
  ];

  const nodes: Node<StatementNodeData>[] = all.map(s => ({
    id: s.id,
    type: 'statement',
    position: { x: 0, y: 0 },
    selected: false,
    data: {
      label: s.stat_title,
      statType: s.stat_type as StatementNodeData['statType'],
      direction: s.stat_direction as 'for' | 'against' | null,
      isRetracted: !!s.retracted_at,
      isOwner: false,
      hasChildren: false,
      canCreate: false,
      allowedChildren: [],
      onUpdate: () => {},
      onRetract: () => {},
      onCreateChild: () => {},
    },
  }));

  const edges: Edge[] = relationships.map(r => ({
    id: `${r.stat_id_supported}__${r.stat_id_supported_by}`,
    source: r.stat_id_supported,
    target: r.stat_id_supported_by,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#475569', width: 14, height: 14 },
    style: { stroke: '#475569', strokeWidth: 1.5 },
  }));

  return { nodes, edges };
}

async function applyElkLayout(
  nodes: Node<StatementNodeData>[],
  edges: Edge[],
): Promise<{ nodes: Node<StatementNodeData>[]; edges: Edge[] }> {
  if (nodes.length <= 1) {
    return { nodes: nodes.map(n => ({ ...n, position: { x: 0, y: 0 } })), edges };
  }

  const elkMod = await import('elkjs/lib/elk.bundled.js');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ELK = (elkMod as any).default ?? elkMod;
  const elk = new ELK();

  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '60',
      'elk.layered.spacing.nodeNodeBetweenLayers': '50',
    },
    children: nodes.map(n => ({ id: n.id, width: NODE_W, height: TOTAL_H })),
    edges: edges.map(e => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layout: any = await elk.layout(elkGraph);

  return {
    nodes: nodes.map(n => {
      const en = layout.children?.find((c: { id: string }) => c.id === n.id);
      return { ...n, position: { x: en?.x ?? 0, y: en?.y ?? 0 } };
    }),
    edges,
  };
}

export default function ChamberGraph({
  resolution, statements, relationships, selectedId, userId,
  onNodeClick, onUpdateNode, onRetractNode, onCreateChild,
}: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<StatementNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rfRef = useRef<any>(null);

  // Stable refs for callbacks — avoids stale closures in node data
  const onUpdateRef      = useRef(onUpdateNode);
  const onRetractRef     = useRef(onRetractNode);
  const onCreateChildRef = useRef(onCreateChild);
  onUpdateRef.current      = onUpdateNode;
  onRetractRef.current     = onRetractNode;
  onCreateChildRef.current = onCreateChild;

  const stableUpdate      = useCallback((id: string) => onUpdateRef.current(id), []);
  const stableRetract     = useCallback((id: string) => onRetractRef.current(id), []);
  const stableCreateChild = useCallback((id: string) => onCreateChildRef.current(id), []);

  // ── Layout: reruns when visible statement set or relationship count changes
  const statIdKey = [resolution.id, ...statements.map(s => s.id)].join(',');
  useEffect(() => {
    const { nodes: raw, edges: rawEdges } = buildGraph(resolution, statements, relationships);
    applyElkLayout(raw, rawEdges).then(({ nodes: laid, edges: laidEdges }) => {
      setNodes(decorateNodes(laid, statements, relationships, resolution, userId, stableUpdate, stableRetract, stableCreateChild));
      setEdges(laidEdges);
      setTimeout(() => rfRef.current?.fitView({ padding: 0.25, duration: 400 }), 60);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statIdKey, relationships.length]);

  // ── Data-sync: update ownership/retracted/callbacks without re-layout
  useEffect(() => {
    setNodes(prev =>
      prev.length === 0
        ? prev
        : decorateNodes(prev, statements, relationships, resolution, userId, stableUpdate, stableRetract, stableCreateChild),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statements, relationships, userId]);

  // ── Selection-sync: lightweight, only toggles selected flag
  useEffect(() => {
    setNodes(prev => prev.map(n => ({ ...n, selected: n.id === selectedId })));
  }, [selectedId, setNodes]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => onNodeClick(node.id),
    [onNodeClick],
  );
  const handlePaneClick = useCallback(() => onNodeClick(''), [onNodeClick]);

  return (
    <div className="w-full h-full">
      <style>{`
        .react-flow__controls-button{background:#111827!important;border-color:#1e3a5f!important;fill:#94a3b8!important;}
        .react-flow__controls-button:hover{background:#1e293b!important;fill:#e2e8f0!important;}
        .react-flow__controls-button svg{fill:inherit;}
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onInit={instance => { rfRef.current = instance; }}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.15}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1e293b" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────

function decorateNodes(
  nodes: Node<StatementNodeData>[],
  statements: ChamberStatement[],
  relationships: ChamberRelationship[],
  resolution: { id: string; created_by: string | null },
  userId: string | null,
  onUpdate: (id: string) => void,
  onRetract: (id: string) => void,
  onCreateChild: (id: string) => void,
): Node<StatementNodeData>[] {
  const stmtMap    = new Map(statements.map(s => [s.id, s]));
  const parentIds  = new Set(relationships.map(r => r.stat_id_supported));

  return nodes.map(n => {
    const isRes    = n.id === resolution.id;
    const stmt     = isRes ? null : stmtMap.get(n.id);
    const createdBy = isRes ? resolution.created_by : stmt?.created_by ?? null;
    const statType  = (isRes ? 'resolution' : stmt?.stat_type ?? 'claim') as string;

    return {
      ...n,
      // selected managed by selection-sync effect
      data: {
        ...n.data,
        isRetracted:     isRes ? false : !!stmt?.retracted_at,
        isOwner:         userId != null && createdBy === userId,
        hasChildren:     parentIds.has(n.id),
        canCreate:       userId != null,
        allowedChildren: PF_ALLOWED_CHILDREN[statType] ?? [],
        onUpdate,
        onRetract,
        onCreateChild,
      },
    };
  });
}
