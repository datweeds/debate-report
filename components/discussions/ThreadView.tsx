'use client';

import MembersOnly from './MembersOnly';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import RichText from './RichText';
import EmojiPicker from './EmojiPicker';
import { SEALED_LIMITS, timeAgo } from './ThreadList';
import SecureAccessDialog from '@/components/sealed/SecureAccessDialog';
import { useSecureAccess } from '@/components/sealed/useSecureAccess';
import { openThreadText, sealThreadText, threadKeys, type ThreadKeys } from '@/components/sealed/items';
import { safetyCode } from '@/lib/sealed/core';

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🎉', '🤔', '✅'];
const MAX_INDENT = 4;     // deeper replies stay at this indent (and say who they reply to)
const SHOW_REPLIES = 3;   // more replies than this to one message: the rest behind "Show more"

type Post = {
  id: string; reply_to: string | null; created_at: string; edited_at: string | null; created_by: string | null;
  body: string | null; deleted: boolean; author: string | null; author_name: string | null;
  reactions: { emoji: string; count: number; mine: boolean }[];
  unreadable?: boolean;   // sealed, and this person has no key for it (yet)
};
type Data = {
  thread: { id: string; title: string; pinned: boolean; locked: boolean; created_by: string | null; author: string | null; protection: 'server' | 'sealed' };
  posts: Post[]; me: string | null; canPost: boolean; canModerate: boolean; canTakeDown: boolean;
};

// One discussion: messages, replies, reactions and the composer. Can run
// full screen (the default on phones) so the conversation gets the whole display.
export default function ThreadView({ societyId, threadId }: { societyId: number; threadId: string }) {
  const router = useRouter();
  const base = `/api/societies/${societyId}`;
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [membersOnly, setMembersOnly] = useState<{ visibility: string; pending: boolean } | null>(null);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<Post | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [reporting, setReporting] = useState<{ id: string; reason: string; note: string; done?: string } | null>(null);
  const [sending, setSending] = useState(false);
  // Full screen on phones from the first draw (deciding after it made the page jump)
  const [full, setFull] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches);
  const [hidden, setHidden] = useState<Set<string>>(new Set());     // messages whose replies are hidden
  const [showAll, setShowAll] = useState<Set<string>>(new Set());   // messages showing all their replies
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  // Sealed threads: messages arrive encrypted and are opened here with this person's keys
  const access = useSecureAccess();
  const keysRef = useRef<ThreadKeys | null>(null);
  const rawRef = useRef<Data | null>(null);
  const [keyState, setKeyState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [dialog, setDialog] = useState<'setup' | 'unlock' | null>(null);
  const [showMembers, setShowMembers] = useState(false);

  const opened = useCallback((d: Data): Data => {
    if (d.thread.protection !== 'sealed') return d;
    const keys = keysRef.current?.keys;
    const open = (v: string) => openThreadText(keys, threadId, v);
    return {
      ...d,
      thread: { ...d.thread, title: open(d.thread.title) ?? 'Sealed discussion' },
      posts: d.posts.map(p => {
        if (p.body == null) return p;
        const text = open(p.body);
        return { ...p, body: text, unreadable: text == null };
      }),
    };
  }, [threadId]);

  const refreshKeys = useCallback(async () => {
    if (!access.identity) return;
    setKeyState('loading');
    try {
      keysRef.current = await threadKeys(base, threadId, access.identity);
      setKeyState('ready');
      if (rawRef.current) setData(opened(rawRef.current));
    } catch { setKeyState('error'); }
  }, [access.identity, base, threadId, opened]);

  const load = useCallback(async () => {
    const r = await fetch(`${base}/threads/${threadId}`);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      if (d.membersOnly) { setMembersOnly({ visibility: d.visibility, pending: d.pending }); return; }
      setError(r.status === 404 ? 'This discussion no longer exists.' : 'Could not load the discussion.'); return;
    }
    const d = await r.json() as Data;
    rawRef.current = d;
    setData(opened(d));
    // A message under a key we don't have yet (someone started a new one): fetch keys again
    const keys = keysRef.current?.keys;
    if (d.thread.protection === 'sealed' && keys && d.posts.some(p => p.body?.startsWith('sn1:') && !keys.has(Number(p.body.split(':')[1])))) void refreshKeys();
  }, [base, threadId, opened, refreshKeys]);

  useEffect(() => { load(); }, [load]);
  const isSealed = data?.thread.protection === 'sealed';
  useEffect(() => {
    if (isSealed && access.status === 'ready' && keyState === 'idle') void refreshKeys();
  }, [isSealed, access.status, keyState, refreshKeys]);

  // Text as it's sent: sealed in the browser for a sealed thread
  const outgoing = (text: string): string | null => {
    if (!isSealed) return text;
    return keysRef.current?.keys.has(keysRef.current.epoch) ? sealThreadText(keysRef.current, threadId, text) : null;
  };
  // A sealed thread's keys may have moved on (someone left): get them and try once more
  async function sendSealedAware(url: string, method: string, make: () => object | null): Promise<Response | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const payload = make();
      if (!payload) { setError(isSealed ? 'You can’t write here until you have access to this sealed discussion.' : 'Could not send'); return null; }
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (r.ok || !isSealed || r.status !== 400 || attempt) return r;
      await refreshKeys();
    }
    return null;
  }

  // Refresh every 10 seconds while the tab is visible
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible' && !editing) load(); }, 10000);
    return () => clearInterval(t);
  }, [load, editing]);

  // Scroll to the newest message when new ones arrive
  useEffect(() => {
    if (data && data.posts.length !== lastCount.current) {
      lastCount.current = data.posts.length;
      bottomRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [data]);

  // Lock page scroll behind the full-screen view
  useEffect(() => {
    document.body.style.overflow = full ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [full]);

  function insertEmoji(e: string) {
    const el = inputRef.current;
    const start = el?.selectionStart ?? body.length;
    setBody(b => b.slice(0, start) + e + b.slice(el?.selectionEnd ?? start));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + e.length, start + e.length); });
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true); setError('');
    const r = await sendSealedAware(`${base}/threads/${threadId}/posts`, 'POST', () => {
      const text = outgoing(body.trim());
      return text == null ? null : { body: text, replyTo: replyTo?.id };
    });
    setSending(false);
    if (!r) return;
    if (!r.ok) { setError((await r.json()).error ?? 'Could not send'); return; }
    if (replyTo) {
      // Open the branch the reply went into, so it can be seen
      setHidden(h => { const n = new Set(h); n.delete(replyTo.id); return n; });
      setShowAll(x => new Set(x).add(replyTo.id));
    }
    setBody(''); setReplyTo(null);
    load();
  }

  async function react(post: Post, emoji: string) {
    await fetch(`${base}/posts/${post.id}/react`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji }),
    });
    load();
  }

  async function saveEdit() {
    if (!editing) return;
    const r = await sendSealedAware(`${base}/posts/${editing.id}`, 'PATCH', () => {
      const text = outgoing(editing.text.trim());
      return text == null ? null : { body: text };
    });
    if (!r) return;
    if (r.ok) { setEditing(null); load(); } else setError((await r.json()).error ?? 'Could not save');
  }

  async function report() {
    if (!reporting) return;
    const r = await fetch(`/api/societies/${societyId}/posts/${reporting.id}/report`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      // A sealed message: send the text as you see it, since the server can't read it
      body: JSON.stringify({ reason: reporting.reason, note: reporting.note,
        ...(isSealed ? { text: data?.posts.find(p => p.id === reporting.id)?.body ?? '' } : {}) }),
    });
    const d = await r.json().catch(() => ({}));
    setReporting({ ...reporting, done: r.ok ? 'Reported. The Society’s moderators will review it.' : d.error ?? 'Could not send the report.' });
  }

  async function remove(post: Post) {
    if (!confirm('Delete this message?')) return;
    await fetch(`${base}/posts/${post.id}`, { method: 'DELETE' });
    load();
  }

  async function moderate(change: { pinned?: boolean; locked?: boolean }) {
    await fetch(`${base}/threads/${threadId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(change),
    });
    load();
  }

  async function deleteThread() {
    if (!confirm('Delete this whole discussion?')) return;
    await fetch(`${base}/threads/${threadId}`, { method: 'DELETE' });
    router.push(`/society/${societyId}/discussions`);
  }

  if (membersOnly) return <MembersOnly societyId={societyId} visibility={membersOnly.visibility} pending={membersOnly.pending} />;
  // A sealed thread whose keys are still on their way: keep the placeholder up,
  // rather than drawing it locked and then again with its text
  const keysPending = data?.thread.protection === 'sealed' && !keysRef.current
    && (access.status === 'loading' || (access.status === 'ready' && keyState !== 'error'));
  if (!data || keysPending) return error ? <p className="text-sm text-rose-400">{error}</p> : <div className="h-40 rounded-2xl bg-slate-800/40 animate-pulse" />;

  const byId = new Map(data.posts.map(p => [p.id, p]));
  // Replies grouped under the message they answer (oldest first); messages whose
  // parent is gone start their own branch
  const children = new Map<string, Post[]>();
  const roots: Post[] = [];
  for (const p of data.posts) {
    if (p.reply_to && byId.has(p.reply_to)) {
      const list = children.get(p.reply_to) ?? [];
      list.push(p); children.set(p.reply_to, list);
    } else roots.push(p);
  }
  const countAll = (id: string): number => (children.get(id) ?? []).reduce((n, c) => n + 1 + countAll(c.id), 0);
  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
    set(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const shell = full
    ? 'fixed inset-0 z-[60] flex flex-col bg-dr-base'
    : 'flex flex-col rounded-2xl border border-slate-800 bg-dr-card h-[calc(100vh-15rem)] min-h-[28rem]';

  function renderPost(p: Post, depth: number): React.ReactNode {
    if (!data) return null;
    // Indentation shows who a reply answers; past the deepest indent, say so in words
    const quoted = p.reply_to && depth > MAX_INDENT ? byId.get(p.reply_to) : null;
    const mine = p.created_by === data.me;
    return (
      <div className="group flex gap-2.5">
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-bold text-blue-300">
          {(p.author ?? '?').slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500">
            <span className="font-semibold text-slate-300">{p.author_name || `@${p.author ?? 'unknown'}`}</span>
            {' · '}{timeAgo(p.created_at)}{p.edited_at && !p.deleted ? ' · edited' : ''}
          </p>
          {quoted && (
            <div className="mt-1 border-l-2 border-slate-600 pl-2 text-xs text-slate-500 line-clamp-2">
              Replying to @{quoted.author ?? 'unknown'}: {quoted.deleted ? '(deleted)' : quoted.body}
            </div>
          )}
          {p.deleted ? (
            <p className="mt-1 text-sm italic text-slate-600">Message deleted</p>
          ) : editing?.id === p.id ? (
            <div className="mt-1 space-y-2">
              <textarea value={editing.text} onChange={e => setEditing({ id: p.id, text: e.target.value })} rows={3} maxLength={5000}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none" />
              <div className="flex gap-2 text-xs">
                <button onClick={saveEdit} className="rounded bg-blue-600 px-3 py-1 font-semibold text-white hover:bg-blue-500">Save</button>
                <button onClick={() => setEditing(null)} className="text-slate-500 hover:text-slate-300">Cancel</button>
              </div>
            </div>
          ) : p.unreadable ? (
            <p className="mt-1 text-sm italic text-slate-500">🔐 Sealed message: you don’t have the key for it yet.</p>
          ) : (
            <div className="mt-0.5"><RichText text={p.body ?? ''} /></div>
          )}
          {!p.deleted && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {p.reactions.map(r => (
                <button key={r.emoji} onClick={() => data.canPost && react(p, r.emoji)} disabled={!data.canPost}
                  className={`rounded-full border px-2 py-0.5 text-xs ${r.mine ? 'border-blue-500/60 bg-blue-500/15 text-blue-200' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}>
                  {r.emoji} {r.count}
                </button>
              ))}
              {data.canPost && <EmojiPicker small emojis={REACTIONS} label="React" onPick={e => react(p, e)} />}
              <span className="flex gap-3 text-xs text-slate-500 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                {data.canPost && <button onClick={() => { setReplyTo(p); inputRef.current?.focus(); }} className="hover:text-slate-300">Reply</button>}
                {mine && <button onClick={() => setEditing({ id: p.id, text: p.body ?? '' })} className="hover:text-slate-300">Edit</button>}
                {(mine || data.canTakeDown) && <button onClick={() => remove(p)} className="hover:text-rose-400">Delete</button>}
                {!mine && data.canPost && <button onClick={() => setReporting({ id: p.id, reason: 'inappropriate', note: '' })} className="hover:text-amber-300">Report</button>}
              </span>
            </div>
          )}
          {reporting?.id === p.id && (
            <div className="mt-2 max-w-md space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
              {reporting.done ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-300">{reporting.done}</span>
                  <button onClick={() => setReporting(null)} className="text-slate-500 hover:text-slate-300">Close</button>
                </div>
              ) : (
                <>
                  <p className="font-semibold text-amber-200">Report this message to the moderators</p>
                  <select value={reporting.reason} onChange={e => setReporting({ ...reporting, reason: e.target.value })}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-200">
                    <option value="inappropriate">Inappropriate or abusive</option>
                    <option value="hate_speech">Hate speech</option>
                    <option value="personal_data">Shares personal data</option>
                    <option value="other">Something else</option>
                  </select>
                  <textarea value={reporting.note} onChange={e => setReporting({ ...reporting, note: e.target.value })} rows={2} maxLength={1000}
                    placeholder="Optional: what’s wrong?" className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-200" />
                  <p className="text-slate-500">
                    The moderators and new.vote’s admins are told. The author isn’t told who reported it.
                    {isSealed && ' This discussion is sealed, so your report includes the message as you see it.'}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={report} className="rounded bg-amber-600 px-3 py-1 font-semibold text-white hover:bg-amber-500">Send report</button>
                    <button onClick={() => setReporting(null)} className="text-slate-500 hover:text-slate-300">Cancel</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // A message and, beneath it on a line, its replies (collapsed past a few)
  function renderBranch(p: Post, depth: number): React.ReactNode {
    const kids = children.get(p.id) ?? [];
    const total = countAll(p.id);
    const isHidden = hidden.has(p.id);
    const shown = showAll.has(p.id) ? kids : kids.slice(0, SHOW_REPLIES);
    return (
      <div key={p.id}>
        {renderPost(p, depth)}
        {kids.length > 0 && (
          <div className={depth + 1 <= MAX_INDENT ? 'ml-4 mt-3 border-l-2 border-slate-700/60 pl-3 sm:ml-5 sm:pl-4' : 'mt-3'}>
            <button onClick={() => toggle(setHidden, p.id)} className="mb-2 text-[11px] font-medium text-slate-500 hover:text-blue-300">
              {isHidden ? `▸ Show replies (${total})` : `▾ Hide replies (${total})`}
            </button>
            {!isHidden && (
              <div className="space-y-4">
                {shown.map(c => renderBranch(c, depth + 1))}
                {kids.length > shown.length && (
                  <button onClick={() => toggle(setShowAll, p.id)} className="text-xs font-medium text-blue-400 hover:text-blue-300">
                    Show {kids.length - shown.length} more {kids.length - shown.length === 1 ? 'reply' : 'replies'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={shell}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-800 px-3 sm:px-4 py-2.5 flex-shrink-0">
        <Link href={`/society/${societyId}/discussions`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200" aria-label="Back to discussions"
          onClick={() => setFull(false)}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
        </Link>
        <h2 className="min-w-0 flex-1 truncate text-sm sm:text-base font-semibold text-slate-100">
          {data.thread.pinned && <span className="mr-1" title="Pinned">📌</span>}
          {data.thread.locked && <span className="mr-1" title="Locked">🔒</span>}
          {isSealed && <span className="mr-1" title="Sealed: end-to-end encrypted">🔐</span>}
          {data.thread.title}
        </h2>
        {data.canModerate && (
          <div className="flex items-center gap-1 text-xs">
            <button onClick={() => moderate({ pinned: !data.thread.pinned })} className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200">{data.thread.pinned ? 'Unpin' : 'Pin'}</button>
            <button onClick={() => moderate({ locked: !data.thread.locked })} className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200">{data.thread.locked ? 'Unlock' : 'Lock'}</button>
          </div>
        )}
        {data.canTakeDown && (
          <button onClick={deleteThread} className="rounded px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/10">Delete</button>
        )}
        <button onClick={() => setFull(f => !f)} aria-label={full ? 'Exit full screen' : 'Full screen'} title={full ? 'Exit full screen' : 'Full screen'}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
          {full ? (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" /></svg>
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
          )}
        </button>
      </div>

      {dialog && <SecureAccessDialog mode={dialog} onDone={() => setDialog(null)} onClose={() => setDialog(null)} />}
      {isSealed && (
        <div className="flex-shrink-0 border-b border-emerald-500/20 bg-emerald-500/5 px-3 sm:px-4 py-2 text-xs text-slate-300">
          <p>
            <span className="font-semibold text-emerald-300">🔐 Sealed:</span> end-to-end encrypted. Only this Society’s members can read it, not new.vote.{' '}
            <span className="text-slate-400">{SEALED_LIMITS}</span>{' '}
            {keysRef.current && <button onClick={() => setShowMembers(v => !v)} className="font-semibold text-blue-300 hover:underline">{showMembers ? 'Hide' : 'Who has access'}</button>}
          </p>
          {access.status === 'none' && <p className="mt-1"><button onClick={() => setDialog('setup')} className="font-semibold text-blue-300 hover:underline">Set up secure access</button> to read and write here.</p>}
          {access.status === 'locked' && <p className="mt-1"><button onClick={() => setDialog('unlock')} className="font-semibold text-blue-300 hover:underline">Unlock secure access</button> on this device with your recovery phrase.</p>}
          {access.status === 'ready' && keyState === 'ready' && !keysRef.current?.keys.size && (
            <p className="mt-1 text-amber-200">Waiting for access: another member’s browser shares the key with you the next time they open this discussion.</p>
          )}
          {showMembers && keysRef.current && (
            <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/60 p-2">
              <p className="mb-1 text-slate-400">Members and their safety codes. To be sure no one else has slipped in, compare codes with a member in person or by phone.</p>
              <ul className="space-y-0.5">
                {keysRef.current.members.map(m => (
                  <li key={m.user_id} className="flex flex-wrap gap-x-3">
                    <span className="text-slate-200">@{m.handle}</span>
                    {m.public_key
                      ? <span className="font-mono text-slate-400">{safetyCode(m.public_key)}</span>
                      : <span className="text-slate-500">no secure access yet</span>}
                    {m.public_key && !(m.epochs ?? []).includes(keysRef.current!.epoch) && <span className="text-amber-300">waiting for access</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-4">
        {roots.map(p => renderBranch(p, 0))}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 border-t border-slate-800 px-3 sm:px-4 py-2.5" style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}>
        {error && <p className="mb-1 text-xs text-rose-400">{error}</p>}
        {data.canPost ? (
          <form onSubmit={send}>
            {replyTo && (
              <div className="mb-1.5 flex items-center gap-2 rounded-lg bg-slate-800/60 px-2 py-1 text-xs text-slate-400">
                <span className="min-w-0 flex-1 truncate">Replying to @{replyTo.author}: {replyTo.body}</span>
                <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="text-slate-500 hover:text-slate-300">✕</button>
              </div>
            )}
            <div className="flex items-end gap-1.5">
              <EmojiPicker onPick={insertEmoji} />
              <textarea ref={inputRef} value={body} onChange={e => setBody(e.target.value)} rows={1} maxLength={5000}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); }}
                placeholder="Write a message…"
                title="Ctrl+Enter to send"
                className="max-h-40 min-h-[2.5rem] flex-1 resize-y rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none" />
              <button type="submit" disabled={sending || !body.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
                {sending ? '…' : 'Send'}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-xs text-slate-500">
            {data.thread.locked ? 'This discussion is locked.' : 'Log in and join this Society to take part.'}
          </p>
        )}
      </div>
    </div>
  );
}
