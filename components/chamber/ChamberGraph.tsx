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
import StatementNode, { type StatementNodeData } from './StatementNode';

const nodeTypes = { statement: StatementNode };

export type ChamberStatement = {
  id: string;
  stat_type: string;
  stat_title: string;
  stat_direction: string | null;
};

export type ChamberRelationship = {
  stat_id_supported: string;
  stat_id_supported_by: string;
};

type Props = {
  resolution: { id: string; stat_title: string };
  statements: ChamberStatement[];
  relationships: ChamberRelationship[];
  selectedId: string | null;
  onNodeClick: (id: string) => void;
};

function buildGraph(
  resolution: { id: string; stat_title: string },
  statements: ChamberStatement[],
  relationships: ChamberRelationship[],
  selectedId: string | null,
): { nodes: Node<StatementNodeData>[]; edges: Edge[] } {
  const all = [
    { id: resolution.id, stat_type: 'resolution', stat_title: resolution.stat_title, stat_direction: null },
    ...statements,
  ];

  const nodes: Node<StatementNodeData>[] = all.map(s => ({
    id: s.id,
    type: 'statement',
    position: { x: 0, y: 0 },
    selected: s.id === selectedId,
    data: {
      label: s.stat_title,
      statType: s.stat_type as StatementNodeData['statType'],
      direction: s.stat_direction as 'for' | 'against' | null,
    },
  }));

  // Edges: source = the node being supported (visually higher), target = the supporter (visually lower)
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
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
    },
    children: nodes.map(n => ({ id: n.id, width: 230, height: 110 })),
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
  resolution, statements, relationships, selectedId, onNodeClick,
}: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<StatementNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rfRef = useRef<any>(null);

  // Recompute full layout when the debate data changes
  useEffect(() => {
    const { nodes: raw, edges: rawEdges } = buildGraph(resolution, statements, relationships, selectedId);
    applyElkLayout(raw, rawEdges).then(({ nodes: laid, edges: laidEdges }) => {
      setNodes(laid);
      setEdges(laidEdges);
      setTimeout(() => rfRef.current?.fitView({ padding: 0.25, duration: 400 }), 60);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolution.id, statements.length, relationships.length]);

  // Sync selection without re-layout
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
