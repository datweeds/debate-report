'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import EmojiPicker from './EmojiPicker';

type Thread = {
  id: string; title: string; created_at: string; last_post_at: string;
  pinned: boolean; locked: boolean; author: string | null; post_count: number; last_author: string | null;
};

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// A Society's discussions: the list, and a form to start a new one.
export default function ThreadList({ societyId }: { societyId: number }) {
  const router = useRouter();
  const [data, setData] = useState<{ threads: Thread[]; canPost: boolean } | null>(null);
  const [error, setError] = useState('');
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/societies/${societyId}/threads`);
    if (r.ok) setData(await r.json()); else setError('Could not load discussions.');
  }, [societyId]);
  useEffect(() => { load(); }, [load]);

  // ?new=1&title=…&body=… opens the form prefilled (e.g. "Discuss" on a News story)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('new') !== '1') return;
    setComposing(true);
    setTitle((q.get('title') ?? '').slice(0, 200));
    setBody(q.get('body') ?? '');
  }, []);

  function insertEmoji(e: string) {
    const el = bodyRef.current;
    if (!el) { setBody(b => b + e); return; }
    const start = el.selectionStart ?? body.length;
    setBody(b => b.slice(0, start) + e + b.slice(el.selectionEnd ?? start));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + e.length, start + e.length); });
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    const r = await fetch(`/api/societies/${societyId}/threads`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body }),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) { setError(d.error ?? 'Could not start the discussion'); return; }
    router.push(`/society/${societyId}/discussions/${d.id}`);
  }

  if (!data) return error ? <p className="text-sm text-rose-400">{error}</p> : <div className="h-32 rounded-2xl bg-slate-800/40 animate-pulse" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">Talk about anything to do with this Society.</p>
        {data.canPost && !composing && (
          <button onClick={() => setComposing(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            + Start a discussion
          </button>
        )}
      </div>

      {composing && (
        <form onSubmit={create} className="rounded-2xl border border-slate-800 bg-[#0c1322] p-4 space-y-3">
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} required autoFocus
            placeholder="Title"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none" />
          <textarea ref={bodyRef} value={body} onChange={e => setBody(e.target.value)} rows={5} maxLength={5000} required
            placeholder="What would you like to discuss? Links are fine."
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none" />
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex items-center gap-2">
            <EmojiPicker onPick={insertEmoji} />
            <span className="flex-1" />
            <button type="button" onClick={() => setComposing(false)} className="text-sm text-slate-500 hover:text-slate-300 px-2">Cancel</button>
            <button type="submit" disabled={saving || !title.trim() || !body.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
              {saving ? 'Posting…' : 'Post'}
            </button>
          </div>
        </form>
      )}

      {!data.canPost && (
        <p className="text-xs text-slate-500">Log in and join this Society to take part.</p>
      )}

      {data.threads.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-10 text-center text-sm text-slate-500">
          No discussions yet.{data.canPost ? ' Start the first one.' : ''}
        </div>
      ) : (
        <ul className="divide-y divide-slate-800/60 rounded-2xl border border-slate-800 bg-[#0c1322] overflow-hidden">
          {data.threads.map(t => (
            <li key={t.id}>
              <Link href={`/society/${societyId}/discussions/${t.id}`} className="flex items-start gap-3 px-4 py-3.5 hover:bg-slate-800/40 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-100">
                    {t.pinned && <span className="mr-1.5 text-amber-400" title="Pinned">📌</span>}
                    {t.locked && <span className="mr-1.5" title="Locked">🔒</span>}
                    {t.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Started by @{t.author ?? 'unknown'}
                    {t.last_author && t.post_count > 1 ? ` · last reply by @${t.last_author}` : ''}
                    {' · '}{timeAgo(t.last_post_at)}
                  </p>
                </div>
                <span className="flex-shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400" title="Messages">
                  {t.post_count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
