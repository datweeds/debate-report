'use client';

import { useEffect, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  ControlButton,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import StatementNode, { type StatementNodeData, NODE_W, BTN_H, computeNodeH } from './StatementNode';
import { PF_ALLOWED_CHILDREN, STAT_LABEL } from './constants';
import type { StatMetrics } from './ListPanel';

const nodeTypes = { statement: StatementNode };

export type ChamberStatement = {
  id: string;
  stat_type: string;
  stat_title: string;
  stat_direction: string | null;
  retracted_at: string | null;
  created_by: string | null;
  stat_description: string | null;
};

export type ChamberRelationship = {
  stat_id_supported: string;
  stat_id_supported_by: string;
};

export type ChamberGraphHandle = {
  exportSVG: (title: string) => void;
  resetLayout: () => void;
};

type Props = {
  resolution: { id: string; stat_title: string; stat_description: string | null; created_by: string | null };
  statements: ChamberStatement[];
  relationships: ChamberRelationship[];
  selectedId: string | null;
  userId: string | null;
  metrics: StatMetrics[] | null;
  onNodeClick: (id: string) => void;
  onUpdateNode: (id: string) => void;
  onRetractNode: (id: string) => void;
  onCreateChild: (parentId: string, type: string, direction: 'for' | 'against' | null) => void;
  onChat: (id: string) => void;
  onVote: (id: string) => void;
  onDescriptionPopup: (id: string) => void;
  onArgue?: (id: string) => void;
  canArgue?: boolean;
  onAnalyse?: (id: string) => void;
  canAnalyse?: boolean;
  onMounted?: (handle: ChamberGraphHandle) => void;
};

// ── SVG helpers ───────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current.length + word.length + 1 > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && current && !lines[maxLines - 1].endsWith(current)) {
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…';
  }
  return lines;
}

const SVG_BADGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  resolution: { bg: '#1e3a5f', text: '#93c5fd', border: '#2563eb' },
  framework:  { bg: '#1e3a5f', text: '#93c5fd', border: '#2563eb' },
  claim:      { bg: '#312e81', text: '#a5b4fc', border: '#4338ca' },
  warrant:    { bg: '#713f12', text: '#fde68a', border: '#b45309' },
  evidence:   { bg: '#14532d', text: '#86efac', border: '#15803d' },
  impact:     { bg: '#713f12', text: '#fde68a', border: '#b45309' },
  rebuttal:   { bg: '#7f1d1d', text: '#fca5a5', border: '#b91c1c' },
  turn:       { bg: '#7f1d1d', text: '#fca5a5', border: '#b91c1c' },
};

function buildNodeSvg(n: Node<StatementNodeData>, ox: number, oy: number): string {
  const nodeH = computeNodeH(n.data.label);
  const nx = n.position.x + ox;
  const ny = n.position.y + oy;
  const d = n.data;
  const isRes = d.statType === 'resolution';

  const fill = d.isRetracted ? '#172033'
    : isRes ? '#1e293b'
    : d.direction === 'for' ? '#071810'
    : d.direction === 'against' ? '#180a0a'
    : '#0c1322';
  const stroke = d.isRetracted ? '#334155'
    : isRes ? '#2563eb'
    : d.direction === 'for' ? '#15803d'
    : d.direction === 'against' ? '#b91c1c'
    : '#334155';

  let parts = '';

  parts += `<rect x="${nx}" y="${ny}" width="${NODE_W}" height="${nodeH}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;

  // Title
  const titleLines = wrapText(d.label, 30, 5);
  let ty = ny + 22;
  for (const line of titleLines) {
    parts += `<text x="${nx+12}" y="${ty}" font-family="Arial,sans-serif" font-size="11" font-weight="500" fill="${d.isRetracted ? '#64748b' : '#f1f5f9'}">${escapeXml(line)}</text>`;
    ty += 15;
  }

  // Badge row
  const badgeY = ny + 10 + titleLines.length * 15 + 10;
  const bc = SVG_BADGE_COLORS[d.statType] ?? { bg: '#334155', text: '#cbd5e1', border: '#475569' };
  const badgeLabel = STAT_LABEL[d.statType]?.slice(0, 6) ?? d.statType.slice(0, 6);
  const badgeW = badgeLabel.length * 6 + 14;
  parts += `<rect x="${nx+10}" y="${badgeY}" width="${badgeW}" height="16" rx="4" fill="${bc.bg}" stroke="${bc.border}50"/>`;
  parts += `<text x="${nx+10+badgeW/2}" y="${badgeY+11}" font-family="Arial,sans-serif" font-size="8.5" font-weight="bold" fill="${bc.text}" text-anchor="middle">${escapeXml(badgeLabel)}</text>`;

  let bx2 = nx + 10 + badgeW + 5;
  if (d.direction) {
    const dLabel = d.direction === 'for' ? 'For' : 'Against';
    const dBg   = d.direction === 'for' ? '#1e3a5f' : '#7f1d1d';
    const dText = d.direction === 'for' ? '#93c5fd' : '#fca5a5';
    const dW    = dLabel.length * 6 + 14;
    parts += `<rect x="${bx2}" y="${badgeY}" width="${dW}" height="16" rx="4" fill="${dBg}" stroke="${dText}40"/>`;
    parts += `<text x="${bx2+dW/2}" y="${badgeY+11}" font-family="Arial,sans-serif" font-size="8.5" font-weight="bold" fill="${dText}" text-anchor="middle">${escapeXml(dLabel)}</text>`;
    bx2 += dW + 5;
  }

  if (d.hasAnalysis) {
    const sW = 38;
    parts += `<rect x="${bx2}" y="${badgeY}" width="${sW}" height="16" rx="4" fill="#14532d" stroke="#15803d50"/>`;
    parts += `<text x="${bx2+sW/2}" y="${badgeY+11}" font-family="Arial,sans-serif" font-size="8.5" font-weight="bold" fill="#86efac" text-anchor="middle">Sci ✓</text>`;
    bx2 += sW + 5;
  }

  // Inline metrics in SVG
  const totalV = d.agreeCount + d.disagreeCount;
  if (totalV > 0) {
    parts += `<text x="${bx2}" y="${badgeY+11}" font-family="Arial,sans-serif" font-size="8.5" fill="#34d399">✓${d.agreeCount}</text>`;
    bx2 += 28;
    parts += `<text x="${bx2}" y="${badgeY+11}" font-family="Arial,sans-serif" font-size="8.5" fill="#f87171">✗${d.disagreeCount}</text>`;
    bx2 += 28;
  }
  if (d.chatCount > 0) {
    parts += `<text x="${bx2}" y="${badgeY+11}" font-family="Arial,sans-serif" font-size="8.5" fill="#c4b5fd">💬${d.chatCount}</text>`;
  }

  return parts;
}

// ── Graph builder ─────────────────────────────────────────────────────────────

function buildGraph(
  resolution: { id: string; stat_title: string; stat_description: string | null; created_by: string | null },
  statements: ChamberStatement[],
  relationships: ChamberRelationship[],
): { nodes: Node<StatementNodeData>[]; edges: Edge[] } {
  const all: ChamberStatement[] = [
    {
      id: resolution.id, stat_type: 'resolution', stat_title: resolution.stat_title,
      stat_direction: null, retracted_at: null, created_by: resolution.created_by,
      stat_description: resolution.stat_description,
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
      description: s.stat_description,
      agreeCount: 0, disagreeCount: 0,
      totalFor: 0, totalAgainst: 0,
      chatCount: 0, hasAnalysis: false, isFlagged: false,
      onUpdate: () => {},
      onRetract: () => {},
      onCreateChild: () => {},
      onChat: () => {},
      onVote: () => {},
      onDescriptionPopup: () => {},
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

// ── ELK layout ────────────────────────────────────────────────────────────────

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
    children: nodes.map(n => ({
      id: n.id,
      width: NODE_W,
      height: computeNodeH(n.data.label) + BTN_H,
    })),
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

// ── Decorate helper ───────────────────────────────────────────────────────────

function decorateNodes(
  nodes: Node<StatementNodeData>[],
  statements: ChamberStatement[],
  relationships: ChamberRelationship[],
  resolution: { id: string; stat_title: string; stat_description: string | null; created_by: string | null },
  userId: string | null,
  metrics: StatMetrics[] | null,
  onUpdate: (id: string) => void,
  onRetract: (id: string) => void,
  onCreateChild: (id: string, type: string, direction: 'for' | 'against' | null) => void,
  onChat: (id: string) => void,
  onVote: (id: string) => void,
  onDescriptionPopup: (id: string) => void,
  onArgue: ((id: string) => void) | undefined,
  onAnalyse: ((id: string) => void) | undefined,
): Node<StatementNodeData>[] {
  const stmtMap    = new Map(statements.map(s => [s.id, s]));
  const parentIds  = new Set(relationships.map(r => r.stat_id_supported));
  const metricsMap = new Map(metrics?.map(m => [m.id, m]) ?? []);

  return nodes.map(n => {
    const isRes     = n.id === resolution.id;
    const stmt      = isRes ? null : stmtMap.get(n.id);
    const createdBy = isRes ? resolution.created_by : stmt?.created_by ?? null;
    const statType  = (isRes ? 'resolution' : stmt?.stat_type ?? 'claim') as string;
    const desc      = isRes ? resolution.stat_description : stmt?.stat_description ?? null;
    const title     = isRes ? resolution.stat_title : stmt?.stat_title ?? n.data.label;
    const m         = metricsMap.get(n.id);

    return {
      ...n,
      data: {
        ...n.data,
        label:           title,
        description:     desc,
        isRetracted:     isRes ? false : !!stmt?.retracted_at,
        isOwner:         userId != null && createdBy === userId,
        hasChildren:     parentIds.has(n.id),
        canCreate:       userId != null,
        allowedChildren: PF_ALLOWED_CHILDREN[statType] ?? [],
        agreeCount:      m?.agree_count     ?? 0,
        disagreeCount:   m?.disagree_count  ?? 0,
        totalFor:        m?.vote_total_for  ?? 0,
        totalAgainst:    m?.vote_total_against ?? 0,
        chatCount:       m?.chat_count      ?? 0,
        hasAnalysis:     m?.has_analysis    ?? false,
        isFlagged:       (m?.flag_count     ?? 0) > 0,
        onUpdate,
        onRetract,
        onCreateChild,
        onChat,
        onVote,
        onDescriptionPopup,
        onArgue,
        onAnalyse,
      },
    };
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ChamberGraph({
  resolution, statements, relationships, selectedId, userId, metrics,
  onNodeClick, onUpdateNode, onRetractNode, onCreateChild, onChat, onVote, onDescriptionPopup,
  onArgue, canArgue, onAnalyse, canAnalyse,
  onMounted,
}: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<StatementNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rfRef = useRef<any>(null);

  const onUpdateRef         = useRef(onUpdateNode);
  const onRetractRef        = useRef(onRetractNode);
  const onCreateChildRef    = useRef(onCreateChild);
  const onChatRef           = useRef(onChat);
  const onVoteRef           = useRef(onVote);
  const onDescPopupRef      = useRef(onDescriptionPopup);
  const onArgueRef          = useRef(onArgue);
  const onAnalyseRef        = useRef(onAnalyse);
  const userIdRef           = useRef(userId);
  const metricsRef          = useRef(metrics);
  const canArgueRef         = useRef(canArgue);
  const canAnalyseRef       = useRef(canAnalyse);
  onUpdateRef.current       = onUpdateNode;
  onRetractRef.current      = onRetractNode;
  onCreateChildRef.current  = onCreateChild;
  onChatRef.current         = onChat;
  onVoteRef.current         = onVote;
  onDescPopupRef.current    = onDescriptionPopup;
  onArgueRef.current        = onArgue;
  onAnalyseRef.current      = onAnalyse;
  userIdRef.current         = userId;
  metricsRef.current        = metrics;
  canArgueRef.current       = canArgue;
  canAnalyseRef.current     = canAnalyse;

  const stableUpdate        = useCallback((id: string) => onUpdateRef.current(id), []);
  const stableRetract       = useCallback((id: string) => onRetractRef.current(id), []);
  const stableCreateChild   = useCallback((id: string, type: string, dir: 'for' | 'against' | null) => onCreateChildRef.current(id, type, dir), []);
  const stableChat          = useCallback((id: string) => onChatRef.current(id), []);
  const stableVote          = useCallback((id: string) => onVoteRef.current(id), []);
  const stableDescPopup     = useCallback((id: string) => onDescPopupRef.current(id), []);
  const stableArgue         = useCallback((id: string) => onArgueRef.current?.(id), []);
  const stableAnalyse       = useCallback((id: string) => onAnalyseRef.current?.(id), []);

  const runLayout = useCallback(() => {
    const { nodes: raw, edges: rawEdges } = buildGraph(resolution, statements, relationships);
    applyElkLayout(raw, rawEdges).then(({ nodes: laid, edges: laidEdges }) => {
      setNodes(decorateNodes(laid, statements, relationships, resolution, userIdRef.current, metricsRef.current, stableUpdate, stableRetract, stableCreateChild, stableChat, stableVote, stableDescPopup, canArgueRef.current ? stableArgue : undefined, canAnalyseRef.current ? stableAnalyse : undefined));
      setEdges(laidEdges);
      setTimeout(() => rfRef.current?.fitView({ padding: 0.25, duration: 400 }), 60);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolution.id, statements.map(s => s.id).join(','), relationships.length]);

  // Layout: reruns when visible statement set or relationship count changes
  const statIdKey = [resolution.id, ...statements.map(s => s.id)].join(',');
  useEffect(() => {
    runLayout();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statIdKey, relationships.length]);

  // Data-sync: update labels/ownership/retracted/metrics/callbacks without re-layout
  useEffect(() => {
    setNodes(prev =>
      decorateNodes(prev, statements, relationships, resolution, userId, metrics, stableUpdate, stableRetract, stableCreateChild, stableChat, stableVote, stableDescPopup, canArgue ? stableArgue : undefined, canAnalyse ? stableAnalyse : undefined),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statements, relationships, userId, metrics, canArgue, canAnalyse]);

  // Selection-sync
  useEffect(() => {
    setNodes(prev => prev.map(n => ({ ...n, selected: n.id === selectedId })));
  }, [selectedId, setNodes]);

  // Expose handle via onMounted callback
  const onMountedRef = useRef(onMounted);
  onMountedRef.current = onMounted;
  useEffect(() => {
    onMountedRef.current?.({
      resetLayout: runLayout,
      exportSVG: (debateTitle: string) => {
        const currentNodes = rfRef.current?.getNodes() as Node<StatementNodeData>[] | undefined;
        const currentEdges = rfRef.current?.getEdges() as Edge[] | undefined;
        if (!currentNodes?.length) return;

        const PAD      = 50;
        const HEADER_H = 52;
        const minX = Math.min(...currentNodes.map(n => n.position.x));
        const minY = Math.min(...currentNodes.map(n => n.position.y));
        const maxX = Math.max(...currentNodes.map(n => n.position.x + NODE_W));
        const maxY = Math.max(...currentNodes.map(n => n.position.y + computeNodeH(n.data.label)));
        const ox   = -minX + PAD;
        const oy   = -minY + PAD + HEADER_H;
        const svgW = maxX - minX + PAD * 2;
        const svgH = maxY - minY + PAD * 2 + HEADER_H;

        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`;
        svg += `<rect width="${svgW}" height="${svgH}" fill="#080d1a"/>`;

        const printDate = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
        svg += `<rect x="0" y="0" width="${svgW}" height="${HEADER_H}" fill="#0c1322"/>`;
        svg += `<text x="18" y="22" font-family="Arial,sans-serif" font-size="15" font-weight="bold" fill="#60a5fa">debate.report</text>`;
        svg += `<text x="18" y="40" font-family="Arial,sans-serif" font-size="11" fill="#94a3b8">${escapeXml(debateTitle)}</text>`;
        svg += `<text x="${svgW - 18}" y="40" font-family="Arial,sans-serif" font-size="10" fill="#475569" text-anchor="end">Printed: ${printDate}</text>`;
        svg += `<line x1="0" y1="${HEADER_H}" x2="${svgW}" y2="${HEADER_H}" stroke="#1e293b" stroke-width="1"/>`;

        svg += `<pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="0.5" cy="0.5" r="0.5" fill="#1e293b"/></pattern>`;
        svg += `<rect x="0" y="${HEADER_H}" width="${svgW}" height="${svgH - HEADER_H}" fill="url(#dots)"/>`;

        const nodeMap = new Map(currentNodes.map(n => [n.id, n]));
        for (const edge of currentEdges ?? []) {
          const src = nodeMap.get(edge.source);
          const tgt = nodeMap.get(edge.target);
          if (!src || !tgt) continue;
          const srcH = computeNodeH(src.data.label);
          const sx = src.position.x + NODE_W / 2 + ox;
          const sy = src.position.y + srcH + oy;
          const tx = tgt.position.x + NODE_W / 2 + ox;
          const ty = tgt.position.y + oy;
          const my = (sy + ty) / 2;
          svg += `<path d="M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}" fill="none" stroke="#475569" stroke-width="1.5"/>`;
          svg += `<polygon points="${tx},${ty} ${tx-4},${ty-7} ${tx+4},${ty-7}" fill="#475569"/>`;
        }

        for (const node of currentNodes) {
          svg += buildNodeSvg(node, ox, oy);
        }

        svg += `</svg>`;

        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        const slug = debateTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        a.download = `debate_${slug}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runLayout]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const nodeH = computeNodeH((node.data as StatementNodeData).label);
      rfRef.current?.setCenter(
        node.position.x + NODE_W / 2,
        node.position.y + (nodeH + BTN_H) / 2,
        { duration: 300, zoom: rfRef.current.getZoom() },
      );
      onNodeClick(node.id);
    },
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
        <Controls showInteractive={false}>
          <ControlButton onClick={runLayout} title="Reset layout">
            <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ width: '1em', height: '1em' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </ControlButton>
        </Controls>
      </ReactFlow>
    </div>
  );
}
