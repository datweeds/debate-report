'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { STAT_BADGE, STAT_LABEL } from './constants';
import type { FullStatement, Resolution } from './types';
import type { ChatGraphMessage } from './ChatGraph';

const ChatGraph = dynamic(() => import('./ChatGraph'), { ssr: false });

// ── Constants ─────────────────────────────────────────────────────────────────

const PRESET_EMOJI   = ['👍', '👎', '❤️', '😂', '😮', '🔥', '🤔', '👏'];
const ALLOWED_TIERS  = new Set(['voter', 'debater', 'moderator', 'sysadmin']);

// ── Types ─────────────────────────────────────────────────────────────────────

type Reaction    = { emoji: string; count: number; userReacted: boolean };
type ChatMessage = {
  id: string; parent_id: string | null; body: string; is_deleted: boolean;
  created_at: string; created_by: string | null; author_handle: string | null;
  reactions: Reaction[];
};
type TreeNode = ChatMessage & { children: TreeNode[] };
type VoteData = {
  userVote: 'agree' | 'disagree' | null;
  agreeCount: number; disagreeCount: number;
  totalFor: number;   totalAgainst: number;
};

export type Props = {
  statement:    FullStatement | Resolution | null;
  userId:       string | null;
  userHandle:   string | null;
  userTier:     string | null;
  openSection?: 'chat' | 'vote';
  openSectionV?: number;
  flagRefreshSignal?: number;
  onClose:           () => void;
  onMetricsRefresh?: () => void;
  onOpenFlagModal?:  () => void;
  onAnalyse?:        (id: string) => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildTree(msgs: ChatMessage[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  msgs.forEach(m => byId.set(m.id, { ...m, children: [] }));
  const roots: TreeNode[] = [];
  msgs.forEach(m => {
    const node = byId.get(m.id)!;
    if (m.parent_id && byId.has(m.parent_id)) byId.get(m.parent_id)!.children.push(node);
    else roots.push(node);
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

// ── MessageNode ───────────────────────────────────────────────────────────────

function MessageNode({
  node, depth, currentUserId, isMod, onReply, onDelete, onReact,
}: {
  node: TreeNode; depth: number; currentUserId: string | null; isMod: boolean;
  onReply:  (id: string, handle: string | null) => void;
  onDelete: (id: string) => void;
  onReact:  (id: string, emoji: string) => void;
}) {
  const isOwn     = !!currentUserId && node.created_by === currentUserId;
  const canDelete = (isOwn || isMod) && !node.is_deleted;
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    function handle(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showPicker]);

  return (
    <div style={{ marginLeft: depth > 0 ? `${Math.min(depth, 4) * 16}px` : 0 }}>
      <div className={`group relative rounded-lg px-3 py-2 mb-1.5 ${
        node.is_deleted ? 'bg-slate-800/20 border border-slate-800/40'
        : isOwn ? 'bg-blue-500/10 border border-blue-500/20'
        : 'bg-slate-800/40 border border-slate-800/60'
      }`}>
        {!node.is_deleted && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold text-slate-400">{node.author_handle ?? 'Unknown'}</span>
            <span className="text-[10px] text-slate-600">{timeAgo(node.created_at)}</span>
          </div>
        )}
        <p className={`text-sm leading-snug ${node.is_deleted ? 'text-slate-600 italic' : 'text-slate-200'}`}>
          {node.body}
        </p>

        {!node.is_deleted && (node.reactions.length > 0 || currentUserId) && (
          <div className="flex flex-wrap items-center gap-1 mt-2 relative">
            {node.reactions.map(r => (
              <button key={r.emoji}
                onClick={() => currentUserId && onReact(node.id, r.emoji)}
                className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs transition-colors ${
                  r.userReacted
                    ? 'bg-violet-500/30 border border-violet-400/40 text-slate-100'
                    : 'bg-slate-700/50 border border-slate-700 text-slate-300 hover:bg-slate-700'
                } ${!currentUserId ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <span>{r.emoji}</span>
                <span className="text-[10px] leading-none">{r.count}</span>
              </button>
            ))}
            {currentUserId && (
              <div ref={pickerRef} className="relative">
                <button onClick={() => setShowPicker(v => !v)}
                  className="inline-flex items-center justify-center w-6 h-5 rounded-full border border-slate-700 bg-slate-800/60 text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors text-xs">
                  +
                </button>
                {showPicker && (
                  <div className="absolute bottom-full left-0 mb-1 z-50 flex gap-0.5 rounded-xl bg-slate-800 border border-slate-700 shadow-lg px-2 py-1.5">
                    {PRESET_EMOJI.map(e => {
                      const already = node.reactions.find(r => r.emoji === e)?.userReacted;
                      return (
                        <button key={e}
                          onClick={() => { onReact(node.id, e); setShowPicker(false); }}
                          className={`rounded-lg p-1 text-base transition-colors hover:bg-slate-700 ${already ? 'bg-violet-500/20' : ''}`}>
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

        {!node.is_deleted && (
          <div className="flex items-center gap-3 mt-1.5">
            {currentUserId && (
              <button onClick={() => onReply(node.id, node.author_handle)}
                className="text-[10px] text-slate-600 hover:text-blue-400 transition-colors">
                ↩ Reply
              </button>
            )}
            {canDelete && (
              <button onClick={() => onDelete(node.id)}
                className="text-[10px] text-slate-600 hover:text-rose-400 transition-colors">
                Delete
              </button>
            )}
          </div>
        )}
      </div>
      {node.children.map(child => (
        <MessageNode key={child.id} node={child} depth={depth + 1}
          currentUserId={currentUserId} isMod={isMod}
          onReply={onReply} onDelete={onDelete} onReact={onReact} />
      ))}
    </div>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────────────────

function SectionHeader({
  label, badge, open, onToggle, accent, extra,
}: {
  label: string; badge?: React.ReactNode; open: boolean;
  onToggle: () => void; accent: string; extra?: React.ReactNode;
}) {
  return (
    <div className={`flex items-center border-t border-slate-800 ${open ? 'bg-slate-900/40' : 'hover:bg-slate-800/20'} transition-colors`}>
      <button onClick={onToggle} className="flex-1 flex items-center gap-2 px-4 py-3 text-left">
        <svg className={`h-3.5 w-3.5 flex-shrink-0 text-slate-600 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
        </svg>
        <span className={`text-xs font-bold uppercase tracking-widest ${accent}`}>{label}</span>
        {badge && (
          <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] bg-slate-800 text-slate-400 leading-none">
            {badge}
          </span>
        )}
      </button>
      {extra}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DetailPanel({
  statement, userId, userHandle, userTier,
  openSection, openSectionV, flagRefreshSignal,
  onClose, onMetricsRefresh, onOpenFlagModal, onAnalyse,
}: Props) {

  // Section open/close
  const [voteOpen, setVoteOpen] = useState(openSection === 'vote');
  const [chatOpen, setChatOpen] = useState(openSection === 'chat');
  const [flagOpen, setFlagOpen] = useState(false);

  // Flag status
  type FlagStatus = { flagCount: number; userFlagged: boolean; reasons: string[] };
  const [flagStatus, setFlagStatus] = useState<FlagStatus | null>(null);

  // Science analysis metadata
  const [scienceDate, setScienceDate] = useState<string | null>(null);

  useEffect(() => {
    setScienceDate(null);
    if (!statement) return;
    fetch(`/api/statements/${statement.id}/science`)
      .then(r => r.json())
      .then(d => setScienceDate(d.analysis?.created_at ?? null))
      .catch(() => {});
  }, [statement?.id]);

  // Vote state — fetched immediately on statement change
  const [voteData,   setVoteData]   = useState<VoteData | null>(null);
  const [voteSaving, setVoteSaving] = useState(false);
  const [voteError,  setVoteError]  = useState('');

  // Chat summary — fetched immediately for header badge
  const [chatRecent, setChatRecent] = useState<number | null>(null);

  // Chat messages — lazy-loaded when section opens
  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [sending,     setSending]     = useState(false);
  const [chatError,   setChatError]   = useState('');
  const [body,        setBody]        = useState('');
  const [replyTo,     setReplyTo]     = useState<{ id: string; handle: string | null } | null>(null);
  const [showGraph,   setShowGraph]   = useState(false);
  const [chatStatId,  setChatStatId]  = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Description overflow detection
  const descRef = useRef<HTMLParagraphElement>(null);
  const [descOverflows, setDescOverflows] = useState(false);
  const [descExpanded,  setDescExpanded]  = useState(false);

  const fullStat    = statement as FullStatement;
  const statType    = statement ? ('stat_type' in fullStat ? fullStat.stat_type : 'resolution') : '';
  const direction   = statement ? ('stat_direction' in fullStat ? fullStat.stat_direction : null) : null;
  const isRetracted = !!(statement && 'retracted_at' in fullStat && fullStat.retracted_at);
  const imagePath   = statement && 'image_path' in statement ? statement.image_path : null;

  const canChat     = !!userId && ALLOWED_TIERS.has(userTier ?? '');
  const isMod       = userTier === 'moderator' || userTier === 'sysadmin';
  const visibleMsgs = messages.filter(m => !m.is_deleted).length;

  // ── Reset when statement changes ──────────────────────────────────────────

  useEffect(() => {
    setVoteData(null); setVoteError(''); setVoteSaving(false);
    setMessages([]); setChatStatId(null); setChatError(''); setChatLoading(false);
    setBody(''); setReplyTo(null); setChatRecent(null);
    setDescExpanded(false); setDescOverflows(false);
    setFlagStatus(null); setFlagOpen(false);
  }, [statement?.id]);

  // ── Immediate fetches on statement change ─────────────────────────────────

  useEffect(() => {
    if (!statement) return;
    fetch(`/api/statements/${statement.id}/vote`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setVoteData(d); })
      .catch(() => {});
  }, [statement?.id]);

  useEffect(() => {
    if (!statement) return;
    fetch(`/api/statements/${statement.id}/chat?summary=1`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setChatRecent(d.recentCount ?? 0); })
      .catch(() => {});
  }, [statement?.id]);

  useEffect(() => {
    if (!statement) return;
    fetch(`/api/statements/${statement.id}/flag`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setFlagStatus(d); })
      .catch(() => {});
  }, [statement?.id, flagRefreshSignal]);

  // ── Description overflow detection ────────────────────────────────────────

  useEffect(() => {
    if (!statement?.stat_description) return;
    const check = () => {
      if (descRef.current) {
        setDescOverflows(descRef.current.scrollHeight > descRef.current.clientHeight + 2);
      }
    };
    const id = setTimeout(check, 50);
    return () => clearTimeout(id);
  }, [statement?.stat_description]);

  // ── Open sections from external triggers ─────────────────────────────────

  useEffect(() => {
    if (openSection === 'vote') setVoteOpen(true);
    if (openSection === 'chat') setChatOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSection, openSectionV]);

  // ── Lazy-load chat messages when section opens ────────────────────────────

  useEffect(() => {
    if (!chatOpen || !statement || chatStatId === statement.id || chatLoading) return;
    setChatLoading(true); setChatError('');
    fetch(`/api/statements/${statement.id}/chat`)
      .then(r => r.json())
      .then(d => { setMessages(d.messages ?? []); setChatStatId(statement.id); setChatLoading(false); })
      .catch(() => { setChatError('Could not load messages'); setChatLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpen, statement?.id]);

  // ── Scroll to bottom on new messages ─────────────────────────────────────

  useEffect(() => {
    if (!chatLoading && chatOpen) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [messages.length, chatLoading, chatOpen]);

  // ── Vote actions ──────────────────────────────────────────────────────────

  async function castVote(vote: 'agree' | 'disagree' | null) {
    if (!userId || !statement) return;
    setVoteSaving(true); setVoteError('');
    try {
      const res = await fetch(`/api/statements/${statement.id}/vote`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote }),
      });
      if (!res.ok) { const d = await res.json(); setVoteError(d.error ?? 'Vote failed'); return; }
      setVoteData(await res.json());
      onMetricsRefresh?.();
    } catch { setVoteError('Network error'); }
    finally { setVoteSaving(false); }
  }

  // ── Chat actions ──────────────────────────────────────────────────────────

  async function handleSend() {
    if (!body.trim() || sending || !statement) return;
    setSending(true); setChatError('');
    try {
      const res = await fetch(`/api/statements/${statement.id}/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim(), parentId: replyTo?.id ?? null }),
      });
      if (!res.ok) { const d = await res.json(); setChatError(d.error ?? 'Failed to send'); return; }
      const { message } = await res.json();
      setMessages(prev => [...prev, message]);
      setChatRecent(prev => (prev ?? 0) + 1);
      onMetricsRefresh?.();
      setBody(''); setReplyTo(null);
    } catch { setChatError('Network error'); }
    finally { setSending(false); }
  }

  async function handleDelete(messageId: string) {
    if (!confirm('Replace this message with "[Deleted message]"?') || !statement) return;
    try {
      const res = await fetch(`/api/statements/${statement.id}/chat/${messageId}`, { method: 'DELETE' });
      if (!res.ok) { setChatError('Could not delete'); return; }
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, body: '[Deleted message]', is_deleted: true, author_handle: null } : m,
      ));
    } catch { setChatError('Network error'); }
  }

  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    if (!userId || !statement) return;
    try {
      const res = await fetch(`/api/statements/${statement.id}/chat/${messageId}/react`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) return;
      const { reacted, count } = await res.json() as { reacted: boolean; count: number };
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        const exists = m.reactions.find(r => r.emoji === emoji);
        let reactions: Reaction[];
        if (exists) {
          reactions = count === 0
            ? m.reactions.filter(r => r.emoji !== emoji)
            : m.reactions.map(r => r.emoji === emoji ? { ...r, count, userReacted: reacted } : r);
        } else {
          reactions = [...m.reactions, { emoji, count, userReacted: reacted }];
        }
        return { ...m, reactions };
      }));
    } catch { /* silent */ }
  }, [userId, statement?.id]);

  const handleGraphReply = useCallback((id: string, handle: string | null) => {
    setShowGraph(false);
    setReplyTo({ id, handle });
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const totalVotes   = (voteData?.agreeCount ?? 0) + (voteData?.disagreeCount ?? 0);
  const agreePercent = totalVotes > 0 ? Math.round((voteData!.agreeCount / totalVotes) * 100) : 0;
  const tree         = buildTree(messages);

  if (!statement) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col w-full h-full bg-[#0c1322]">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-400">Statement</p>
        <button onClick={onClose} className="rounded-lg p-1 text-slate-600 hover:text-slate-400 transition-colors">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto">

        {/* ── Statement info ─────────────────────────────────────────────── */}
        <div className="px-4 py-4 space-y-3">
          {isRetracted && (
            <div className="rounded-lg border border-slate-600/30 bg-slate-700/20 px-3 py-2 text-xs text-slate-500">
              This statement has been retracted.
            </div>
          )}
          <p className={`text-base font-semibold leading-snug ${isRetracted ? 'text-slate-500' : 'text-slate-100'}`}>
            {statement.stat_title}
          </p>

          {/* Type + direction badges */}
          <div className="flex flex-wrap gap-2">
            {isRetracted && (
              <span className="rounded px-2 py-0.5 text-xs font-bold border bg-slate-700/40 text-slate-500 border-slate-600/30">
                Retracted
              </span>
            )}
            <span className={`rounded px-2 py-0.5 text-xs font-bold border ${STAT_BADGE[statType] ?? STAT_BADGE.claim}`}>
              {STAT_LABEL[statType] ?? statType}
            </span>
            {direction && (
              <span className={`rounded px-2 py-0.5 text-xs font-bold border ${
                direction === 'for' ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
                : 'bg-rose-500/20 text-rose-200 border-rose-500/40'
              }`}>
                {direction === 'for' ? 'For' : 'Against'}
              </span>
            )}
          </div>

          {/* Resolution image */}
          {imagePath && (
            <div className="rounded-xl overflow-hidden border border-slate-700/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePath}
                alt=""
                className="w-full object-cover max-h-52"
              />
            </div>
          )}

          {/* Description — clamped with expander */}
          {statement.stat_description && (
            <div>
              <p
                ref={descRef}
                className={`text-sm text-slate-300 leading-relaxed ${!descExpanded ? 'line-clamp-5' : ''}`}
              >
                {statement.stat_description}
              </p>
              {descOverflows && (
                <button
                  onClick={() => setDescExpanded(v => !v)}
                  className="mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {descExpanded ? 'Show less' : 'More detail…'}
                </button>
              )}
            </div>
          )}

          {/* Meta */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <svg className="h-3 w-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5" />
              </svg>
              {new Date(statement.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            {statement.creator_handle && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <svg className="h-3 w-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
                @{statement.creator_handle}
              </div>
            )}
          </div>
        </div>

        {/* ── Science Analysis section ──────────────────────────────────── */}
        {onAnalyse && statement && (
          <div className="border-t border-slate-800/60 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <svg className="h-3.5 w-3.5 text-teal-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15a2.25 2.25 0 0 1 .45 1.32v.74c0 .513.416.929.93.929h.12a.93.93 0 0 0 .93-.93v-.74A2.25 2.25 0 0 1 21.68 15M19.8 15H4.2" />
              </svg>
              <span className="text-xs font-semibold text-slate-300">Science Analysis</span>
              {scienceDate ? (
                <span className="text-[10px] text-slate-500">
                  · {new Date(scienceDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              ) : (
                <span className="text-[10px] text-slate-600 italic">· not yet run</span>
              )}
            </div>
            <button
              onClick={() => onAnalyse(statement.id)}
              className="flex-shrink-0 text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors"
            >
              {scienceDate ? 'View →' : 'Run →'}
            </button>
          </div>
        )}

        {/* ── Vote section ──────────────────────────────────────────────── */}
        <SectionHeader
          label="Vote" accent="text-emerald-500" open={voteOpen}
          onToggle={() => setVoteOpen(v => !v)}
          badge={voteData ? `${totalVotes} vote${totalVotes !== 1 ? 's' : ''}` : undefined}
        />
        {voteOpen && (
          <div className="px-4 py-4 space-y-4">
            {!voteData ? (
              <div className="space-y-2">
                {[0, 1].map(i => <div key={i} className="h-12 rounded-lg bg-slate-800/50 animate-pulse" />)}
              </div>
            ) : voteError ? (
              <p className="text-xs text-red-400">{voteError}</p>
            ) : (
              <>
                {voteData.userVote && (
                  <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border text-sm font-semibold ${
                    voteData.userVote === 'agree'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}>
                    <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      {voteData.userVote === 'agree'
                        ? <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        : <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />}
                    </svg>
                    You voted: {voteData.userVote === 'agree' ? 'Agree' : 'Disagree'}
                    <button onClick={() => castVote(null)} disabled={voteSaving}
                      className="ml-auto text-xs underline opacity-70 hover:opacity-100">
                      Remove
                    </button>
                  </div>
                )}

                {userId ? (
                  <div className="grid grid-cols-2 gap-2">
                    {(['agree', 'disagree'] as const).map(v => (
                      <button key={v}
                        onClick={() => castVote(voteData.userVote === v ? null : v)}
                        disabled={voteSaving}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 transition-all active:scale-95 ${
                          voteData.userVote === v
                            ? v === 'agree'
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
                              : 'bg-rose-500/20 border-rose-500/50 text-rose-200'
                            : v === 'agree'
                              ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-emerald-500/40 hover:text-emerald-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-rose-500/40 hover:text-rose-300'
                        }`}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          {v === 'agree'
                            ? <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.253m0 0a2.25 2.25 0 0 1-2.25-2.25v-4a2.25 2.25 0 0 1 2.25-2.25h.254" />
                            : <path strokeLinecap="round" strokeLinejoin="round" d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715a12.137 12.137 0 0 1-.068-1.285c0-2.848.992-5.464 2.649-7.521C5.287 4.247 5.886 4 6.504 4h4.016a4.5 4.5 0 0 1 1.423.23l3.114 1.04a4.5 4.5 0 0 0 1.423.23h1.294M7.498 15.25c.618 0 .991.724.725 1.282A7.471 7.471 0 0 0 7.5 19.75 2.25 2.25 0 0 0 9.75 22a.75.75 0 0 0 .75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 0 0 2.861-2.4c.498-.634 1.226-1.08 2.032-1.08h.384m-10.253 1.5H9.7m8.075-9.75c.01.05.027.1.05.148.593 1.2.925 2.55.925 3.977 0 1.487-.36 2.89-.999 4.125m.023-8.25c-.076-.365.183-.75.575-.75h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398C20.613 14.547 19.833 15 19 15h-1.053c-.472 0-.745-.556-.5-.96a8.95 8.95 0 0 0 .303-.54" />}
                        </svg>
                        <span className="text-xs font-bold capitalize">{v}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-1">Log in to vote</p>
                )}

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">This Statement</p>
                  <div className="grid grid-cols-2 gap-2 mb-1.5">
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-center">
                      <p className="text-lg font-bold text-emerald-300">{voteData.agreeCount}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Agree</p>
                    </div>
                    <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-center">
                      <p className="text-lg font-bold text-rose-300">{voteData.disagreeCount}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Disagree</p>
                    </div>
                  </div>
                  {totalVotes > 0 && (
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${agreePercent}%` }} />
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">Including Downstream</p>
                  <div className="grid grid-cols-2 gap-2 mb-1.5">
                    <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-center">
                      <p className="text-lg font-bold text-blue-300">{voteData.totalFor}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">For</p>
                    </div>
                    <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 px-3 py-2 text-center">
                      <p className="text-lg font-bold text-orange-300">{voteData.totalAgainst}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Against</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-600 leading-snug">
                    Agree on For statements → For the resolution. Agree on Against → Against.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Flags section ─────────────────────────────────────────────── */}
        <SectionHeader
          label="Flags"
          accent={flagStatus && flagStatus.flagCount > 0 ? 'text-red-400' : 'text-slate-500'}
          open={flagOpen}
          onToggle={() => setFlagOpen(v => !v)}
          badge={flagStatus && flagStatus.flagCount > 0 ? `${flagStatus.flagCount}` : undefined}
        />
        {flagOpen && (
          <div className="px-4 py-4 space-y-3">
            {!flagStatus ? (
              <div className="h-8 rounded bg-slate-800/50 animate-pulse" />
            ) : flagStatus.flagCount === 0 ? (
              <p className="text-xs text-slate-500 text-center py-1">No flags on this statement.</p>
            ) : (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 space-y-1.5">
                <p className="text-xs font-semibold text-red-300">
                  Flagged {flagStatus.flagCount} time{flagStatus.flagCount !== 1 ? 's' : ''}
                </p>
                {flagStatus.reasons.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {flagStatus.reasons.map(r => (
                      <span key={r} className="rounded-full bg-red-900/40 border border-red-700/40 px-2 py-0.5 text-[10px] text-red-300">
                        {r === 'inappropriate' ? 'Inappropriate / Offensive' : r === 'hate_speech' ? 'Hate Speech' : 'Contains Personal Data'}
                      </span>
                    ))}
                  </div>
                )}
                {flagStatus.userFlagged && (
                  <p className="text-[10px] text-slate-500">You have flagged this statement.</p>
                )}
              </div>
            )}
            <button
              onClick={onOpenFlagModal}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-xs font-semibold text-slate-400 hover:border-red-500/40 hover:text-red-300 hover:bg-red-500/10 transition-all"
            >
              <span className="flex items-center justify-center gap-1.5">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
                </svg>
                {flagStatus?.userFlagged ? 'View flag details' : 'Flag this statement'}
              </span>
            </button>
          </div>
        )}

        {/* ── Chat section ──────────────────────────────────────────────── */}
        <SectionHeader
          label="Chat" accent="text-violet-400" open={chatOpen}
          onToggle={() => setChatOpen(v => !v)}
          badge={chatRecent !== null ? `${chatRecent} message${chatRecent !== 1 ? 's' : ''} last 7 days` : undefined}
          extra={chatOpen ? (
            <button onClick={() => setShowGraph(true)} title="Open chat graph"
              className="px-3 py-3 text-slate-500 hover:text-slate-300 transition-colors">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185z" />
              </svg>
            </button>
          ) : undefined}
        />
        {chatOpen && (
          <div className="px-3 py-3">
            {chatLoading ? (
              <p className="text-sm text-slate-500 text-center py-6">Loading…</p>
            ) : chatError ? (
              <p className="text-xs text-red-400 text-center py-4">{chatError}</p>
            ) : messages.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-slate-500">No messages yet</p>
                {canChat && <p className="text-xs text-slate-600 mt-1">Be the first to comment</p>}
              </div>
            ) : (
              <>
                {tree.map(node => (
                  <MessageNode key={node.id} node={node} depth={0}
                    currentUserId={userId} isMod={isMod}
                    onReply={(id, handle) => setReplyTo({ id, handle })}
                    onDelete={handleDelete} onReact={handleReact} />
                ))}
                <div ref={bottomRef} />
              </>
            )}
          </div>
        )}
      </div>

      {/* Compose — pinned bottom when chat open */}
      {chatOpen && (
        <div className="flex-shrink-0 border-t border-slate-800 px-3 py-3 bg-[#0c1322]">
          {chatError && <p className="text-xs text-red-400 mb-2">{chatError}</p>}
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
                rows={3} maxLength={2000}
                placeholder="Type a message… (emoji welcome 😊)"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-violet-500/50 focus:outline-none resize-none placeholder-slate-600"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-700">Ctrl+Enter to send</span>
                <button onClick={handleSend} disabled={!body.trim() || sending}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-40 transition-colors">
                  {sending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </div>
          ) : userId ? (
            <p className="text-xs text-slate-600 text-center">Voter, Debater, or Moderator tier required to chat</p>
          ) : (
            <p className="text-xs text-slate-600 text-center">Log in to join the chat</p>
          )}
        </div>
      )}

      {/* Chat graph popup */}
      {showGraph && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="relative flex flex-col bg-[#080d1a] rounded-2xl border border-slate-700 shadow-2xl overflow-hidden"
            style={{ width: '88vw', maxWidth: 1200, height: '84vh' }}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <svg className="h-4 w-4 text-violet-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185z" />
                </svg>
                <h3 className="text-sm font-semibold text-slate-200">Chat Thread Graph</h3>
                <span className="text-[10px] text-slate-600 truncate ml-1">{statement.stat_title}</span>
              </div>
              <button onClick={() => setShowGraph(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {messages.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-10">No messages yet</p>
              ) : (
                <ChatGraph messages={messages as ChatGraphMessage[]} userId={userId}
                  onReact={handleReact} onReply={handleGraphReply} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
