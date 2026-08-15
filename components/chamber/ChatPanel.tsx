'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { ChatGraphMessage } from './ChatGraph';

const ChatGraph = dynamic(() => import('./ChatGraph'), { ssr: false });

const PRESET_EMOJI = ['👍','👎','❤️','😂','😮','🔥','🤔','👏'];

type Reaction = { emoji: string; count: number; userReacted: boolean };

type ChatMessage = {
  id: string;
  parent_id: string | null;
  body: string;
  is_deleted: boolean;
  created_at: string;
  created_by: string | null;
  author_handle: string | null;
  reactions: Reaction[];
};

type TreeNode = ChatMessage & { children: TreeNode[] };

function buildTree(msgs: ChatMessage[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  msgs.forEach(m => byId.set(m.id, { ...m, children: [] }));
  const roots: TreeNode[] = [];
  msgs.forEach(m => {
    const node = byId.get(m.id)!;
    if (m.parent_id && byId.has(m.parent_id)) {
      byId.get(m.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function MessageNode({
  node, depth, currentUserId, isMod, onReply, onDelete, onReact,
}: {
  node: TreeNode;
  depth: number;
  currentUserId: string | null;
  isMod: boolean;
  onReply: (id: string, handle: string | null) => void;
  onDelete: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
}) {
  const isOwn    = !!currentUserId && node.created_by === currentUserId;
  const canDelete = (isOwn || isMod) && !node.is_deleted;
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPicker]);

  const hasReactions = node.reactions.length > 0;

  return (
    <div style={{ marginLeft: depth > 0 ? `${Math.min(depth, 4) * 16}px` : 0 }}>
      <div className={`group relative rounded-lg px-3 py-2 mb-1.5 ${
        node.is_deleted
          ? 'bg-slate-800/20 border border-slate-800/40'
          : isOwn
          ? 'bg-blue-500/10 border border-blue-500/20'
          : 'bg-slate-800/40 border border-slate-800/60'
      }`}>
        {!node.is_deleted && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold text-slate-400">
              {node.author_handle ?? 'Unknown'}
            </span>
            <span className="text-[10px] text-slate-600">{timeAgo(node.created_at)}</span>
          </div>
        )}
        <p className={`text-sm leading-snug ${node.is_deleted ? 'text-slate-600 italic' : 'text-slate-200'}`}>
          {node.body}
        </p>

        {/* Reaction pills */}
        {!node.is_deleted && (hasReactions || currentUserId) && (
          <div className="flex flex-wrap items-center gap-1 mt-2 relative">
            {node.reactions.map(r => (
              <button
                key={r.emoji}
                onClick={() => currentUserId && onReact(node.id, r.emoji)}
                title={r.userReacted ? `You reacted ${r.emoji} — click to remove` : `React with ${r.emoji}`}
                className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs transition-colors ${
                  r.userReacted
                    ? 'bg-violet-500/30 border border-violet-400/40 text-slate-100'
                    : 'bg-slate-700/50 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-600'
                } ${!currentUserId ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <span>{r.emoji}</span>
                <span className="text-[10px] leading-none">{r.count}</span>
              </button>
            ))}

            {currentUserId && !node.is_deleted && (
              <div ref={pickerRef} className="relative">
                <button
                  onClick={() => setShowPicker(v => !v)}
                  title="Add reaction"
                  className="inline-flex items-center justify-center w-6 h-5 rounded-full border border-slate-700 bg-slate-800/60 text-slate-500 hover:text-slate-300 hover:bg-slate-700 hover:border-slate-600 transition-colors text-xs"
                >
                  +
                </button>
                {showPicker && (
                  <div className="absolute bottom-full left-0 mb-1 z-50 flex gap-0.5 rounded-xl bg-slate-800 border border-slate-700 shadow-lg px-2 py-1.5">
                    {PRESET_EMOJI.map(e => {
                      const already = node.reactions.find(r => r.emoji === e)?.userReacted;
                      return (
                        <button
                          key={e}
                          onClick={() => { onReact(node.id, e); setShowPicker(false); }}
                          title={already ? `Remove ${e}` : `React with ${e}`}
                          className={`rounded-lg p-1 text-base transition-colors hover:bg-slate-700 ${already ? 'bg-violet-500/20' : ''}`}
                        >
                          {e}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Text actions */}
        {!node.is_deleted && (
          <div className="flex items-center gap-3 mt-1.5">
            {currentUserId && (
              <button
                onClick={() => onReply(node.id, node.author_handle)}
                className="text-[10px] text-slate-600 hover:text-blue-400 transition-colors"
              >
                ↩ Reply
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete(node.id)}
                className="text-[10px] text-slate-600 hover:text-rose-400 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {node.children.map(child => (
        <MessageNode
          key={child.id}
          node={child}
          depth={depth + 1}
          currentUserId={currentUserId}
          isMod={isMod}
          onReply={onReply}
          onDelete={onDelete}
          onReact={onReact}
        />
      ))}
    </div>
  );
}

type Props = {
  statementId: string;
  statementTitle: string;
  userId: string | null;
  userHandle: string | null;
  userTier: string | null;
  onClose: () => void;
};

const ALLOWED_TIERS = new Set(['voter', 'debater', 'moderator', 'sysadmin']);

export default function ChatPanel({
  statementId, statementTitle, userId, userHandle, userTier, onClose,
}: Props) {
  const [messages,  setMessages]  = useState<ChatMessage[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);
  const [error,     setError]     = useState('');
  const [body,      setBody]      = useState('');
  const [replyTo,   setReplyTo]   = useState<{ id: string; handle: string | null } | null>(null);
  const [showGraph, setShowGraph] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const canChat = !!userId && ALLOWED_TIERS.has(userTier ?? '');
  const isMod   = userTier === 'moderator' || userTier === 'sysadmin';

  const load = useCallback(() => {
    fetch(`/api/statements/${statementId}/chat`)
      .then(r => r.json())
      .then(d => { setMessages(d.messages ?? []); setLoading(false); })
      .catch(() => { setError('Could not load messages'); setLoading(false); });
  }, [statementId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!loading) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [messages.length, loading]);

  async function handleSend() {
    if (!body.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch(`/api/statements/${statementId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim(), parentId: replyTo?.id ?? null }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Failed to send');
        return;
      }
      const { message } = await res.json();
      setMessages(prev => [...prev, message]);
      setBody('');
      setReplyTo(null);
    } catch {
      setError('Network error');
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(messageId: string) {
    if (!confirm('Replace this message with "[Deleted message]"?')) return;
    try {
      const res = await fetch(`/api/statements/${statementId}/chat/${messageId}`, { method: 'DELETE' });
      if (!res.ok) { setError('Could not delete'); return; }
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, body: '[Deleted message]', is_deleted: true, author_handle: null } : m,
      ));
    } catch {
      setError('Network error');
    }
  }

  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/statements/${statementId}/chat/${messageId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) return;
      const { reacted, count } = await res.json() as { reacted: boolean; count: number };
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        const exists = m.reactions.find(r => r.emoji === emoji);
        let reactions: Reaction[];
        if (exists) {
          if (count === 0) {
            reactions = m.reactions.filter(r => r.emoji !== emoji);
          } else {
            reactions = m.reactions.map(r => r.emoji === emoji ? { ...r, count, userReacted: reacted } : r);
          }
        } else {
          reactions = [...m.reactions, { emoji, count, userReacted: reacted }];
        }
        return { ...m, reactions };
      }));
    } catch { /* silent */ }
  }, [userId, statementId]);

  const handleGraphReact = useCallback(async (messageId: string, emoji: string) => {
    await handleReact(messageId, emoji);
    setShowGraph(false);
  }, [handleReact]);

  const handleGraphReply = useCallback((id: string, handle: string | null) => {
    setShowGraph(false);
    setReplyTo({ id, handle });
  }, []);

  const tree = buildTree(messages);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="h-4 w-4 text-violet-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
          </svg>
          <h2 className="text-sm font-semibold text-slate-200">Chat</h2>
          <span className="text-[10px] text-slate-600 ml-1">{messages.filter(m => !m.is_deleted).length} messages</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setShowGraph(true)}
            title="Open chat graph"
            className="rounded p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185z" />
            </svg>
          </button>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Statement title */}
      <div className="px-4 py-2.5 border-b border-slate-800/60 flex-shrink-0">
        <p className="text-xs text-slate-500 truncate">{statementTitle}</p>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <p className="text-sm text-slate-500 text-center py-10">Loading…</p>
        ) : messages.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-slate-500">No messages yet</p>
            {canChat && <p className="text-xs text-slate-600 mt-1">Be the first to comment</p>}
          </div>
        ) : (
          <>
            {tree.map(node => (
              <MessageNode
                key={node.id}
                node={node}
                depth={0}
                currentUserId={userId}
                isMod={isMod}
                onReply={(id, handle) => setReplyTo({ id, handle })}
                onDelete={handleDelete}
                onReact={handleReact}
              />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Compose area */}
      <div className="flex-shrink-0 border-t border-slate-800 px-3 py-3">
        {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

        {replyTo && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <span className="text-[11px] text-slate-500 flex-1">
              ↩ Replying to <span className="text-slate-400">{replyTo.handle ?? 'message'}</span>
            </span>
            <button onClick={() => setReplyTo(null)} className="text-slate-600 hover:text-slate-400">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {canChat ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(); }}
              rows={3}
              maxLength={2000}
              placeholder="Type a message… (emoji welcome 😊)"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-violet-500/50 focus:outline-none resize-none placeholder-slate-600"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-700">Ctrl+Enter to send</span>
              <button
                onClick={handleSend}
                disabled={!body.trim() || sending}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-40 transition-colors"
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        ) : userId ? (
          <p className="text-xs text-slate-600 text-center">
            Voter, Debater, or Moderator tier required to chat
          </p>
        ) : (
          <p className="text-xs text-slate-600 text-center">Log in to join the chat</p>
        )}
      </div>

      {/* Chat Graph popup modal */}
      {showGraph && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div
            className="relative flex flex-col bg-[#080d1a] rounded-2xl border border-slate-700 shadow-2xl overflow-hidden"
            style={{ width: '88vw', maxWidth: 1200, height: '84vh' }}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <svg className="h-4 w-4 text-violet-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185z" />
                </svg>
                <h3 className="text-sm font-semibold text-slate-200">Chat Thread Graph</h3>
                <span className="text-[10px] text-slate-600 truncate ml-1">{statementTitle}</span>
              </div>
              <button
                onClick={() => setShowGraph(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors flex-shrink-0"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {messages.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-10">No messages yet</p>
              ) : (
                <ChatGraph
                  messages={messages as ChatGraphMessage[]}
                  userId={userId}
                  onReact={handleGraphReact}
                  onReply={handleGraphReply}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
