'use client';

import { useMemo, useEffect, useContext, createContext, useState } from 'react';
import {
  ReactFlow, Background, BackgroundVariant, Controls,
  useNodesState, useEdgesState, type Node, type Edge, MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const PRESET_EMOJI = ['👍','👎','❤️','😂','😮','🔥','🤔','👏'];

type Reaction = { emoji: string; count: number; userReacted: boolean };

export type ChatGraphMessage = {
  id: string;
  parent_id: string | null;
  body: string;
  is_deleted: boolean;
  created_at: string;
  author_handle: string | null;
  reactions: Reaction[];
};

// ── Context: live callbacks (never stale in node components) ─────────────────

type ChatCtx = {
  userId: string | null;
  onReact: (id: string, emoji: string) => void;
  onReply: (id: string, handle: string | null) => void;
};
const ChatContext = createContext<ChatCtx>({
  userId: null,
  onReact: () => {},
  onReply: () => {},
});

// ── Node data (static per message; reactions updated on change) ──────────────

type ChatNodeData = {
  messageId: string;
  handle: string | null;
  date: string;
  body: string;
  isDeleted: boolean;
  reactions: Reaction[];
};

const NODE_W = 280;
const NODE_H = 160;
const H_GAP  = 56;
const V_GAP  = 88;

function formatDate(s: string) {
  return new Date(s).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ── Custom node component ─────────────────────────────────────────────────────

function ChatMessageNode({ data }: { data: Record<string, unknown> }) {
  const d = data as ChatNodeData;
  const { userId, onReact, onReply } = useContext(ChatContext);
  const canInteract = !!userId;
  const [showPicker, setShowPicker] = useState(false);

  const hasReactions = d.reactions.length > 0;

  return (
    <div
      className={`rounded-xl p-3 ${
        d.isDeleted
          ? 'bg-[#1a1f2e] border border-slate-700'
          : 'bg-[#0c1322] border border-slate-600'
      }`}
      style={{ width: NODE_W, fontSize: 11 }}
    >
      {/* Header */}
      {!d.isDeleted && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="font-semibold text-slate-400 truncate">{d.handle ?? 'Unknown'}</span>
          <span className="text-slate-600 flex-shrink-0">{formatDate(d.date)}</span>
        </div>
      )}

      {/* Body */}
      <p
        className={`leading-snug mb-2 ${d.isDeleted ? 'text-slate-600 italic' : 'text-slate-200'}`}
        style={{ fontSize: 11 }}
      >
        {d.body}
      </p>

      {/* Reaction pills */}
      {!d.isDeleted && (hasReactions || canInteract) && (
        <div className="flex flex-wrap items-center gap-1 mb-1.5">
          {d.reactions.map(r => (
            <button
              key={r.emoji}
              onClick={() => canInteract && onReact(d.messageId, r.emoji)}
              title={r.userReacted ? `Remove ${r.emoji}` : `React with ${r.emoji}`}
              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 transition-colors ${
                r.userReacted
                  ? 'bg-violet-500/30 border border-violet-400/40 text-slate-100'
                  : 'bg-slate-700/50 border border-slate-700 text-slate-300 hover:bg-slate-700'
              } ${!canInteract ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <span>{r.emoji}</span>
              <span className="leading-none" style={{ fontSize: 10 }}>{r.count}</span>
            </button>
          ))}

          {canInteract && (
            <button
              onClick={() => setShowPicker(v => !v)}
              title="Add reaction"
              className={`inline-flex items-center justify-center w-5 h-5 rounded-full border transition-colors ${
                showPicker
                  ? 'border-violet-500/50 bg-violet-500/20 text-violet-300'
                  : 'border-slate-700 bg-slate-800/60 text-slate-500 hover:text-slate-300 hover:bg-slate-700'
              }`}
              style={{ fontSize: 10 }}
            >
              +
            </button>
          )}
        </div>
      )}

      {/* Inline emoji picker */}
      {showPicker && canInteract && !d.isDeleted && (
        <div className="flex flex-wrap gap-0.5 mb-1.5 p-1.5 rounded-xl bg-slate-800/80 border border-slate-700">
          {PRESET_EMOJI.map(e => {
            const already = d.reactions.find(r => r.emoji === e)?.userReacted;
            return (
              <button
                key={e}
                onClick={() => { onReact(d.messageId, e); setShowPicker(false); }}
                title={already ? `Remove ${e}` : `React with ${e}`}
                className={`rounded px-1 py-0.5 transition-colors hover:bg-slate-700 ${already ? 'bg-violet-500/20' : ''}`}
                style={{ fontSize: 15 }}
              >
                {e}
              </button>
            );
          })}
        </div>
      )}

      {/* Reply */}
      {!d.isDeleted && canInteract && (
        <button
          onClick={() => onReply(d.messageId, d.handle)}
          className="text-slate-500 hover:text-blue-400 transition-colors"
          style={{ fontSize: 10 }}
        >
          ↩ Reply
        </button>
      )}
    </div>
  );
}

// Module-level constant — must not be recreated per render
const nodeTypes = { chatMessage: ChatMessageNode };

// ── Layout ────────────────────────────────────────────────────────────────────

function computeLayout(msgs: ChatGraphMessage[]): { nodes: Node[]; edges: Edge[] } {
  const byId       = new Map(msgs.map(m => [m.id, m]));
  const childrenOf = new Map<string | null, ChatGraphMessage[]>();
  msgs.forEach(m => {
    const key = m.parent_id ?? null;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(m);
  });

  const posMap     = new Map<string, { x: number; y: number }>();
  const colAtDepth: number[] = [];

  function place(id: string, depth: number) {
    if (!colAtDepth[depth]) colAtDepth[depth] = 0;
    const col = colAtDepth[depth]++;
    posMap.set(id, { x: col * (NODE_W + H_GAP), y: depth * (NODE_H + V_GAP) });
  }

  (childrenOf.get(null) ?? []).forEach(m => {
    place(m.id, 0);
    const queue: [ChatGraphMessage, number][] = [[m, 0]];
    while (queue.length) {
      const [cur, d] = queue.shift()!;
      (childrenOf.get(cur.id) ?? []).forEach(child => {
        place(child.id, d + 1);
        queue.push([child, d + 1]);
      });
    }
  });

  const nodes: Node[] = msgs.map(m => ({
    id:       m.id,
    type:     'chatMessage',
    position: posMap.get(m.id) ?? { x: 0, y: 0 },
    data: {
      messageId: m.id,
      handle:    m.author_handle,
      date:      m.created_at,
      body:      m.body,
      isDeleted: m.is_deleted,
      reactions: m.reactions,
    } satisfies ChatNodeData,
  }));

  const edges: Edge[] = msgs
    .filter(m => m.parent_id && byId.has(m.parent_id))
    .map(m => ({
      id:        `${m.parent_id}__${m.id}`,
      source:    m.parent_id!,
      target:    m.id,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#475569', width: 12, height: 12 },
      style:     { stroke: '#475569', strokeWidth: 1.5 },
    }));

  return { nodes, edges };
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  messages: ChatGraphMessage[];
  userId: string | null;
  onReact: (id: string, emoji: string) => void;
  onReply: (id: string, handle: string | null) => void;
};

export default function ChatGraph({ messages, userId, onReact, onReply }: Props) {
  const msgKey = messages.map(m => m.id).join(',');

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => computeLayout(messages),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [msgKey],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, , onEdgesChange]         = useEdgesState(layoutEdges);

  // Keep reactions in sync when they change (callbacks come from context — no need to store them)
  useEffect(() => {
    setNodes(prev => prev.map(n => {
      const msg = messages.find(m => m.id === n.id);
      if (!msg) return n;
      return { ...n, data: { ...(n.data as ChatNodeData), reactions: msg.reactions } };
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  return (
    <ChatContext.Provider value={{ userId, onReact, onReply }}>
      <div className="w-full h-full">
        <style>{`
          .react-flow__controls-button{background:#111827!important;border-color:#1e3a5f!important;fill:#94a3b8!important;}
          .react-flow__controls-button:hover{background:#1e293b!important;fill:#e2e8f0!important;}
          .react-flow__controls-button svg{fill:inherit;}
          .react-flow__node{overflow:visible!important;}
          .react-flow__node .react-flow__handle{opacity:0;}
        `}</style>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </ChatContext.Provider>
  );
}
