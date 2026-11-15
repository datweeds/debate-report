'use client';

import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
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
  stat_ref?: string | null;       // debate-unique reference, e.g. CF2, RB1, E14
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

const DIRECTION_RANK: Record<string, number> = { for: 0, against: 2 };
const directionRank = (dir: string | null | undefined) => DIRECTION_RANK[dir ?? ''] ?? 1;

// Every statement beneath each node in the full tree (unique, cycle-safe).
function computeDescendantCounts(childrenByParent: Map<string, string[]>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const root of childrenByParent.keys()) {
    const seen = new Set<string>();
    const stack = [...(childrenByParent.get(root) ?? [])];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id) || id === root) continue;
      seen.add(id);
      stack.push(...(childrenByParent.get(id) ?? []));
    }
    counts.set(root, seen.size);
  }
  return counts;
}

function buildGraph(
  resolution: { id: string; stat_title: string; stat_description: string | null; created_by: string | null },
  statements: ChamberStatement[],
  relationships: ChamberRelationship[],
  expandedNodes: Set<string>,
): { nodes: Node<StatementNodeData>[]; edges: Edge[] } {
  const stmtMap = new Map(statements.map(s => [s.id, s]));
  const childrenByParent = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const r of relationships) {
    const arr = childrenByParent.get(r.stat_id_supported) ?? [];
    arr.push(r.stat_id_supported_by);
    childrenByParent.set(r.stat_id_supported, arr);
    hasParent.add(r.stat_id_supported_by);
  }
  const descendantCounts = computeDescendantCounts(childrenByParent);

  // Walk the tree from the top, depth-first, descending only into expanded
  // nodes. Children are visited For → neutral → Against, and that visiting
  // order is what the layout follows, so it also sets left-to-right order.
  // Statements with no parent (e.g. their parent was retracted and hidden)
  // are treated as extra roots so they never silently disappear.
  const order: string[] = [];          // visible node ids, in model order
  const visibleEdges: [string, string][] = [];
  const visited = new Set<string>();
  const roots = [resolution.id, ...statements.filter(s => !hasParent.has(s.id)).map(s => s.id)];

  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    order.push(id);
    if (!expandedNodes.has(id)) return;

    const kids = [...(childrenByParent.get(id) ?? [])]
      .sort((a, b) => directionRank(stmtMap.get(a)?.stat_direction) - directionRank(stmtMap.get(b)?.stat_direction));
    for (const kid of kids) {
      visibleEdges.push([id, kid]);
      visit(kid);
    }
  };
  for (const root of roots) visit(root);

  const all: ChamberStatement[] = order
    .map(id => id === resolution.id
      ? {
          id: resolution.id, stat_type: 'resolution', stat_title: resolution.stat_title,
          stat_direction: null, retracted_at: null, created_by: resolution.created_by,
          stat_description: resolution.stat_description,
        }
      : stmtMap.get(id)!)
    .filter(Boolean);

  const realNodes: Node<StatementNodeData>[] = all.map(s => ({
    id: s.id,
    type: 'statement',
    position: { x: 0, y: 0 },
    selected: false,
    data: {
      label: s.stat_title,
      statRef: s.stat_ref ?? null,
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
      descendantCount: descendantCounts.get(s.id) ?? 0,
      treeExpanded: expandedNodes.has(s.id),
    },
  }));
  const byId = new Map<string, Node<StatementNodeData>>(realNodes.map(n => [n.id, n]));

  const nodes = order.map(id => byId.get(id)).filter((n): n is Node<StatementNodeData> => !!n);
  const nodeIds = new Set(nodes.map(n => n.id));

  const edges: Edge[] = visibleEdges
    .filter(([s, t]) => nodeIds.has(s) && nodeIds.has(t))
    .map(([source, target]) => ({
      id: `${source}__${target}`,
      source,
      target,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#475569', width: 14, height: 14 },
      style: { stroke: '#475569', strokeWidth: 1.5 },
    }));

  return { nodes, edges };
}

// ── Layout ────────────────────────────────────────────────────────────────────

// Tidy tree layout: every subtree gets its own horizontal band, wide enough for
// everything beneath it, and each parent sits centred over its children. Bands
// never overlap, so expanding a node pushes its neighbours aside instead of
// sliding over them. Siblings keep buildGraph's emit order (For → Against).
// The tree is the first edge into each node from an earlier-emitted node; any
// other edges are still drawn, just not used for placement.
const SUBTREE_GAP = 40;
const LAYER_GAP   = 70;

function tidyTreeLayout(
  nodes: Node<StatementNodeData>[],
  edges: Edge[],
): Map<string, { x: number; y: number }> {
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const parentOf = new Map<string, string>();
  for (const e of edges) {
    const si = index.get(e.source), ti = index.get(e.target);
    if (si === undefined || ti === undefined || si >= ti || parentOf.has(e.target)) continue;
    parentOf.set(e.target, e.source);
  }
  const kidsOf = new Map<string, string[]>();
  const roots: string[] = [];
  for (const n of nodes) {
    const p = parentOf.get(n.id);
    if (p) kidsOf.set(p, [...(kidsOf.get(p) ?? []), n.id]);
    else roots.push(n.id);
  }

  const heightOf = new Map(nodes.map(n => [n.id, computeNodeH(n.data.label) + BTN_H]));
  const widthMemo = new Map<string, number>();
  const width = (id: string): number => {
    const cached = widthMemo.get(id);
    if (cached !== undefined) return cached;
    const kids = kidsOf.get(id) ?? [];
    const kidsW = kids.reduce((s, k) => s + width(k), 0) + SUBTREE_GAP * Math.max(0, kids.length - 1);
    const w = Math.max(NODE_W, kidsW);
    widthMemo.set(id, w);
    return w;
  };

  const xOf = new Map<string, number>();
  const depthOf = new Map<string, number>();
  const place = (id: string, left: number, depth: number) => {
    depthOf.set(id, depth);
    const kids = kidsOf.get(id) ?? [];
    if (!kids.length) { xOf.set(id, left + (width(id) - NODE_W) / 2); return; }
    const kidsW = kids.reduce((s, k) => s + width(k), 0) + SUBTREE_GAP * (kids.length - 1);
    let cursor = left + (width(id) - kidsW) / 2;
    for (const k of kids) { place(k, cursor, depth + 1); cursor += width(k) + SUBTREE_GAP; }
    const first = xOf.get(kids[0])!, last = xOf.get(kids[kids.length - 1])!;
    xOf.set(id, (first + last) / 2);
  };
  let left = 0;
  for (const r of roots) { place(r, left, 0); left += width(r) + SUBTREE_GAP; }

  // Each layer is as tall as its tallest node.
  const layerH: number[] = [];
  for (const [id, d] of depthOf) layerH[d] = Math.max(layerH[d] ?? 0, heightOf.get(id) ?? 0);
  const layerY: number[] = [];
  for (let d = 0, y = 0; d < layerH.length; d++) { layerY[d] = y; y += (layerH[d] ?? 0) + LAYER_GAP; }

  const positions = new Map<string, { x: number; y: number }>();
  for (const n of nodes) positions.set(n.id, { x: xOf.get(n.id) ?? 0, y: layerY[depthOf.get(n.id) ?? 0] ?? 0 });
  return positions;
}

async function applyTreeLayout(
  nodes: Node<StatementNodeData>[],
  edges: Edge[],
): Promise<{ nodes: Node<StatementNodeData>[]; edges: Edge[] }> {
  if (nodes.length <= 1) {
    return { nodes: nodes.map(n => ({ ...n, position: { x: 0, y: 0 } })), edges };
  }

  const positions = tidyTreeLayout(nodes, edges);

  return {
    nodes: nodes.map(n => ({ ...n, position: positions.get(n.id) ?? { x: 0, y: 0 } })),
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

  // The node whose expand/collapse (or reveal) triggered the next re-layout,
  // so the layout can keep that node anchored on screen.
  const lastToggledNodeIdRef = useRef<string | null>(null);

  // Progressive disclosure — which nodes have their direct children shown.
  // A debate loads with only the resolution expanded (so just its direct
  // children are visible); kept per-debate so switching debates starts fresh.
  const [expandState, setExpandState] = useState<{ resId: string; ids: Set<string> }>(
    () => ({ resId: resolution.id, ids: new Set([resolution.id]) }),
  );
  const expandedNodes = useMemo(
    () => (expandState.resId === resolution.id ? expandState.ids : new Set([resolution.id])),
    [expandState, resolution.id],
  );
  const updateExpanded = useCallback((fn: (prev: Set<string>) => Set<string>) => {
    setExpandState(prev => {
      const base = prev.resId === resolution.id ? prev.ids : new Set([resolution.id]);
      return { resId: resolution.id, ids: fn(base) };
    });
  }, [resolution.id]);

  const { childrenOf, parentsOf } = useMemo(() => {
    const c = new Map<string, string[]>();
    const p = new Map<string, string[]>();
    for (const r of relationships) {
      c.set(r.stat_id_supported, [...(c.get(r.stat_id_supported) ?? []), r.stat_id_supported_by]);
      p.set(r.stat_id_supported_by, [...(p.get(r.stat_id_supported_by) ?? []), r.stat_id_supported]);
    }
    return { childrenOf: c, parentsOf: p };
  }, [relationships]);

  const descendantsOf = useCallback((id: string) => {
    const out = new Set<string>();
    const stack = [...(childrenOf.get(id) ?? [])];
    while (stack.length) {
      const n = stack.pop()!;
      if (out.has(n) || n === id) continue;
      out.add(n);
      stack.push(...(childrenOf.get(n) ?? []));
    }
    return out;
  }, [childrenOf]);

  const ancestorsOf = useCallback((id: string) => {
    const out = new Set<string>();
    const stack = [...(parentsOf.get(id) ?? [])];
    while (stack.length) {
      const n = stack.pop()!;
      if (out.has(n)) continue;
      out.add(n);
      stack.push(...(parentsOf.get(n) ?? []));
    }
    return out;
  }, [parentsOf]);

  // Expand goes down one level; collapse folds the whole subtree beneath.
  const toggleNodeExpansion = useCallback((id: string) => {
    if (!childrenOf.get(id)?.length) return;
    lastToggledNodeIdRef.current = id;
    if (expandedNodes.has(id)) {
      const subtree = descendantsOf(id);
      subtree.add(id);
      updateExpanded(prev => new Set([...prev].filter(n => !subtree.has(n))));
    } else {
      updateExpanded(prev => new Set(prev).add(id));
    }
  }, [childrenOf, expandedNodes, descendantsOf, updateExpanded]);

  // Make a statement visible by opening every node above it.
  const revealNode = useCallback((id: string) => {
    const ancestors = ancestorsOf(id);
    if (ancestors.size === 0) return;
    updateExpanded(prev => new Set([...prev, ...ancestors]));
  }, [ancestorsOf, updateExpanded]);

  const runLayout = useCallback((opts?: { fit?: boolean; focusNodeId?: string | null }) => {
    const fit = opts?.fit ?? true;
    const focusNodeId = opts?.focusNodeId;
    const { nodes: raw, edges: rawEdges } = buildGraph(resolution, statements, relationships, expandedNodes);
    // Where the toggled node sits now, before the re-layout moves it.
    const anchor = focusNodeId ? rfRef.current?.getNode(focusNodeId)?.position : undefined;
    applyTreeLayout(raw, rawEdges).then(({ nodes: laidRaw, edges: laidEdges }) => {
      // Shift the whole new layout so the toggled node keeps its old
      // coordinates — it stays put on screen and the graph grows around it.
      const newPos = anchor && laidRaw.find(n => n.id === focusNodeId)?.position;
      const dx = newPos ? anchor.x - newPos.x : 0;
      const dy = newPos ? anchor.y - newPos.y : 0;
      const laid = (dx || dy)
        ? laidRaw.map(n => ({ ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }))
        : laidRaw;
      const decorated = decorateNodes(laid, statements, relationships, resolution, userIdRef.current, metricsRef.current, stableUpdate, stableRetract, stableCreateChild, stableChat, stableVote, stableDescPopup, canArgueRef.current ? stableArgue : undefined, canAnalyseRef.current ? stableAnalyse : undefined);
      // Re-apply selection here too, not just in the separate selection-sync
      // effect below — this rebuild is async, so without this the
      // highlight set by a toggle would get wiped the instant layout lands.
      setNodes(decorated.map(n => ({ ...n, selected: n.id === selectedId })));
      setEdges(laidEdges);
      if (fit) {
        setTimeout(() => rfRef.current?.fitView({ padding: 0.25, duration: 400 }), 60);
      } else if (focusNodeId && !anchor) {
        // Node wasn't on screen before (e.g. revealed from the list): bring it into view.
        const target = laid.find(n => n.id === focusNodeId);
        if (target && rfRef.current) {
          const nodeH = computeNodeH(target.data.label);
          setTimeout(() => rfRef.current?.setCenter(
            target.position.x + NODE_W / 2,
            target.position.y + (nodeH + BTN_H) / 2,
            { duration: 400, zoom: rfRef.current.getZoom() },
          ), 60);
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolution.id, statements.map(s => s.id).join(','), relationships.length, expandedNodes, selectedId]);

  // Layout: reruns when visible statement set, relationship count, or node
  // expansion changes (expanding/collapsing changes which nodes exist). A real
  // data change re-fits the whole graph; a pure expand/collapse toggle instead
  // keeps the toggled node at the same spot on screen (see runLayout).
  const statIdKey = [resolution.id, ...statements.map(s => s.id)].join(',');
  const prevStatIdKeyRef = useRef<string | null>(null);
  const prevRelCountRef  = useRef<number | null>(null);
  useEffect(() => {
    const isFirstRun = prevStatIdKeyRef.current === null;
    const dataChanged = isFirstRun
      || prevStatIdKeyRef.current !== statIdKey
      || prevRelCountRef.current !== relationships.length;
    prevStatIdKeyRef.current = statIdKey;
    prevRelCountRef.current  = relationships.length;
    if (dataChanged) {
      runLayout({ fit: true });
    } else {
      runLayout({ fit: false, focusNodeId: lastToggledNodeIdRef.current });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statIdKey, relationships.length, expandedNodes]);

  // A statement added while its branch is collapsed would otherwise be
  // invisible to the person who just created it — open the path down to it.
  const prevStmtIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const current = new Set(statements.map(s => s.id));
    const prev = prevStmtIdsRef.current;
    prevStmtIdsRef.current = current;
    if (!prev) return;
    // Exactly one new id = someone just added a statement. Several at once is
    // a bulk change (e.g. "show retracted"), which shouldn't unfold the tree.
    const added = [...current].filter(id => !prev.has(id));
    if (added.length !== 1) return;
    lastToggledNodeIdRef.current = added[0];
    revealNode(added[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statIdKey]);
  useEffect(() => { prevStmtIdsRef.current = null; }, [resolution.id]);

  // Selecting a statement from the list that's currently folded away opens
  // its branch, so the graph can then centre on it.
  useEffect(() => {
    if (!selectedId || selectedId === resolution.id) return;
    if (nodes.some(n => n.id === selectedId)) return;
    if (!statements.some(s => s.id === selectedId)) return;
    lastToggledNodeIdRef.current = selectedId;
    revealNode(selectedId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

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
      resetLayout: () => runLayout({ fit: true }),
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
        svg += `<text x="18" y="22" font-family="Arial,sans-serif" font-size="15" font-weight="bold" fill="#60a5fa">new.vote</text>`;
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

  // Tracks the node id the camera is already centered on, so a selection that
  // arrives via prop (from the list panel) doesn't re-center on top of the
  // one handleNodeClick already did for a direct graph click.
  const lastCenteredIdRef = useRef<string | null>(null);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      // No re-centring: a clicked node stays where it is on screen (the
      // expand/collapse re-layout is anchored on it too). Marking it here stops
      // the list-selection effect below from centring it instead.
      lastCenteredIdRef.current = node.id;
      toggleNodeExpansion(node.id);
      onNodeClick(node.id);
    },
    [onNodeClick, toggleNodeExpansion],
  );
  const handlePaneClick = useCallback(() => {
    onNodeClick('');
  }, [onNodeClick]);

  // Selecting a statement from the list panel (rather than clicking its node
  // directly) should still bring it to the centre of the graph, at whatever
  // zoom level the user currently has.
  useEffect(() => {
    if (!selectedId) { lastCenteredIdRef.current = null; return; }
    if (selectedId === lastCenteredIdRef.current) return;
    const target = nodes.find(n => n.id === selectedId);
    if (!target || !rfRef.current) return;
    lastCenteredIdRef.current = selectedId;
    const nodeH = computeNodeH((target.data as StatementNodeData).label);
    rfRef.current.setCenter(
      target.position.x + NODE_W / 2,
      target.position.y + (nodeH + BTN_H) / 2,
      { duration: 300, zoom: rfRef.current.getZoom() },
    );
  }, [selectedId, nodes]);

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
          <ControlButton onClick={() => runLayout({ fit: true })} title="Reset layout">
            <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ width: '1em', height: '1em' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </ControlButton>
        </Controls>
      </ReactFlow>
    </div>
  );
}
