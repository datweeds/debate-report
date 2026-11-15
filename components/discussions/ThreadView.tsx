'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import RichText from './RichText';
import EmojiPicker from './EmojiPicker';
import { timeAgo } from './ThreadList';

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🎉', '🤔', '✅'];

type Post = {
  id: string; reply_to: string | null; created_at: string; edited_at: string | null; created_by: string | null;
  body: string | null; deleted: boolean; author: string | null; author_name: string | null;
  reactions: { emoji: string; count: number; mine: boolean }[];
};
type Data = {
  thread: { id: string; title: string; pinned: boolean; locked: boolean; created_by: string | null; author: string | null };
  posts: Post[]; me: string | null; canPost: boolean; canModerate: boolean; canTakeDown: boolean;
};

// One discussion: messages, replies, reactions and the composer. Can run
// full screen (the default on phones) so the conversation gets the whole display.
export default function ThreadView({ societyId, threadId }: { societyId: number; threadId: string }) {
  const router = useRouter();
  const base = `/api/societies/${societyId}`;
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<Post | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [full, setFull] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  const load = useCallback(async () => {
    const r = await fetch(`${base}/threads/${threadId}`);
    if (!r.ok) { setError(r.status === 404 ? 'This discussion no longer exists.' : 'Could not load the discussion.'); return; }
    setData(await r.json());
  }, [base, threadId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setFull(window.matchMedia('(max-width: 639px)').matches); }, []);

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
    const r = await fetch(`${base}/threads/${threadId}/posts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, replyTo: replyTo?.id }),
    });
    setSending(false);
    if (!r.ok) { setError((await r.json()).error ?? 'Could not send'); return; }
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
    const r = await fetch(`${base}/posts/${editing.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: editing.text }),
    });
    if (r.ok) { setEditing(null); load(); } else setError((await r.json()).error ?? 'Could not save');
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

  if (!data) return error ? <p className="text-sm text-rose-400">{error}</p> : <div className="h-40 rounded-2xl bg-slate-800/40 animate-pulse" />;

  const byId = new Map(data.posts.map(p => [p.id, p]));
  const shell = full
    ? 'fixed inset-0 z-[60] flex flex-col bg-dr-base'
    : 'flex flex-col rounded-2xl border border-slate-800 bg-[#0c1322] h-[calc(100vh-15rem)] min-h-[28rem]';

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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-4">
        {data.posts.map(p => {
          const quoted = p.reply_to ? byId.get(p.reply_to) : null;
          const mine = p.created_by === data.me;
          return (
            <div key={p.id} className="group flex gap-2.5">
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
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
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
