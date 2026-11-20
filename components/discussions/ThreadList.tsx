'use client';

import MembersOnly from './MembersOnly';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import EmojiPicker from './EmojiPicker';
import SecureAccessDialog from '@/components/sealed/SecureAccessDialog';
import { useSecureAccess } from '@/components/sealed/useSecureAccess';
import { allThreadKeys, newSealedThread, openThreadText, type SealedMember } from '@/components/sealed/items';

type Thread = {
  id: string; title: string; created_at: string; last_post_at: string;
  pinned: boolean; locked: boolean; author: string | null; post_count: number; last_author: string | null; new_count: number;
  protection: 'server' | 'sealed';
};

// What a sealed discussion gives up, said wherever someone chooses or opens one
export const SEALED_LIMITS = 'No AI features, no automatic abuse scanning, and no Sys Admin emergency access. Each member needs secure access (a recovery phrase); lost keys can’t be recovered by new.vote.';

const NewBadge = ({ n }: { n: number }) => n > 0
  ? <span className="flex-shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300" title="New messages since you last opened it">{n > 99 ? '99+' : n} new</span>
  : null;

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
  const [data, setData] = useState<{ threads: Thread[]; canPost: boolean; canModerate?: boolean; allowSealed?: boolean } | null>(null);
  const access = useSecureAccess();
  const [sealedKeys, setSealedKeys] = useState<{ byThread: Map<string, Map<number, Uint8Array>>; members: SealedMember[] } | null>(null);
  const [sealIt, setSealIt] = useState(false);
  const [dialog, setDialog] = useState<'setup' | 'unlock' | null>(null);
  const [pinnedOpen, setPinnedOpen] = useState(false);   // pinned threads start collapsed
  const [error, setError] = useState('');
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [membersOnly, setMembersOnly] = useState<{ visibility: string; pending: boolean } | null>(null);
  const load = useCallback(async () => {
    const r = await fetch(`/api/societies/${societyId}/threads`);
    const d = await r.json().catch(() => ({}));
    if (r.ok) setData(d);
    else if (d.membersOnly) setMembersOnly({ visibility: d.visibility, pending: d.pending });
    else setError('Could not load discussions.');
  }, [societyId]);
  useEffect(() => { load(); }, [load]);

  // Sealed threads' titles are opened here, in the browser, with this person's keys
  const hasSealed = !!data?.threads.some(t => t.protection === 'sealed');
  useEffect(() => {
    if (access.status !== 'ready' || !access.identity || (!hasSealed && !sealIt)) return;
    allThreadKeys(`/api/societies/${societyId}`, access.identity).then(setSealedKeys);
  }, [access.status, access.identity, hasSealed, sealIt, societyId]);
  const titleOf = (t: Thread): React.ReactNode => {
    if (t.protection !== 'sealed') return t.title;
    // Keys still loading: a quiet placeholder rather than a title that changes a moment later
    if (access.status === 'loading' || (access.status === 'ready' && !sealedKeys)) {
      return <span className="inline-block h-3.5 w-48 max-w-full animate-pulse rounded bg-slate-700/60 align-middle" aria-label="Loading title" />;
    }
    return openThreadText(sealedKeys?.byThread.get(t.id), t.id, t.title) ?? (access.status === 'ready' ? 'Sealed discussion (waiting for access)' : 'Sealed discussion');
  };

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
    let payload: object = { title, body };
    if (sealIt) {
      // Sealed here, in the browser, for every member with secure access
      if (access.status !== 'ready' || !access.identity) { setSaving(false); setDialog(access.status === 'locked' ? 'unlock' : 'setup'); return; }
      const members = sealedKeys?.members ?? (await allThreadKeys(`/api/societies/${societyId}`, access.identity)).members;
      payload = newSealedThread(members, title.trim().slice(0, 200), body.trim());
    }
    const r = await fetch(`/api/societies/${societyId}/threads`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) { setError(d.error ?? 'Could not start the discussion'); return; }
    router.push(`/society/${societyId}/discussions/${d.id}`);
  }

  // Moderators pin a thread to the top of the board, or unpin it
  async function setPinned(t: Thread, pinned: boolean) {
    const r = await fetch(`/api/societies/${societyId}/threads/${t.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pinned }),
    });
    if (r.ok) { if (pinned) setPinnedOpen(true); load(); }
    else setError((await r.json().catch(() => ({}))).error ?? 'Could not change the pin');
  }

  const row = (t: Thread) => (
    <li key={t.id} className="flex items-stretch">
      <Link href={`/society/${societyId}/discussions/${t.id}`} className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3.5 hover:bg-slate-800/40 transition-colors">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-100">
            {t.pinned && <span className="mr-1.5 text-amber-400" title="Pinned">📌</span>}
            {t.locked && <span className="mr-1.5" title="Locked">🔒</span>}
            {t.protection === 'sealed' && <span className="mr-1.5" title="Sealed: end-to-end encrypted">🔐</span>}
            {titleOf(t)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Started by @{t.author ?? 'unknown'}
            {t.last_author && t.post_count > 1 ? ` · last reply by @${t.last_author}` : ''}
            {' · '}{timeAgo(t.last_post_at)}
          </p>
        </div>
        <NewBadge n={t.new_count} />
        <span className="flex-shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400" title="Messages">
          {t.post_count}
        </span>
      </Link>
      {data?.canModerate && (
        <button onClick={() => setPinned(t, !t.pinned)} title={t.pinned ? 'Unpin from the top of the board' : 'Pin to the top of the board'}
          className="flex-shrink-0 px-3 text-xs text-slate-500 hover:bg-slate-800/40 hover:text-amber-300 transition-colors">
          {t.pinned ? 'Unpin' : 'Pin'}
        </button>
      )}
    </li>
  );

  if (membersOnly) return <MembersOnly societyId={societyId} visibility={membersOnly.visibility} pending={membersOnly.pending} />;
  if (!data) return error ? <p className="text-sm text-rose-400">{error}</p> : <div className="h-32 rounded-2xl bg-slate-800/40 animate-pulse" />;

  return (
    <div className="space-y-4">
      {dialog && <SecureAccessDialog mode={dialog} onDone={() => setDialog(null)} onClose={() => setDialog(null)} />}
      {hasSealed && access.status !== 'ready' && access.status !== 'loading' && access.status !== 'signed-out' && (
        <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs text-slate-300">
          🔐 Some discussions here are sealed.{' '}
          <button onClick={() => setDialog(access.status === 'locked' ? 'unlock' : 'setup')} className="font-semibold text-blue-300 hover:underline">
            {access.status === 'locked' ? 'Unlock secure access' : 'Set up secure access'}
          </button>{' '}to read them.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">Talk about anything to do with this Society.</p>
        {data.canPost && !composing && (
          <button onClick={() => setComposing(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            + Start a discussion
          </button>
        )}
      </div>

      {composing && (
        <form onSubmit={create} className="rounded-2xl border border-slate-800 bg-dr-card p-4 space-y-3">
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} required autoFocus
            placeholder="Title"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none" />
          <textarea ref={bodyRef} value={body} onChange={e => setBody(e.target.value)} rows={5} maxLength={5000} required
            placeholder="What would you like to discuss? Links are fine."
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none" />
          {data.allowSealed && (
            <label className="flex items-start gap-2.5 rounded-lg border border-slate-800 p-2.5 text-xs">
              <input type="checkbox" checked={sealIt} onChange={e => setSealIt(e.target.checked)} className="mt-0.5 accent-emerald-500" />
              <span className="text-slate-300">
                <span className="font-semibold text-slate-100">🔐 Seal this discussion</span>: end-to-end encrypted in members’ browsers, so only members can read it, not new.vote.
                {sealIt && (
                  <span className="mt-1 block text-amber-200/90">
                    {SEALED_LIMITS}
                    {access.status === 'none' && <> <button type="button" onClick={() => setDialog('setup')} className="font-semibold text-blue-300 hover:underline">Set up secure access</button> first.</>}
                    {access.status === 'locked' && <> <button type="button" onClick={() => setDialog('unlock')} className="font-semibold text-blue-300 hover:underline">Unlock secure access</button> on this device first.</>}
                    {access.status === 'ready' && sealedKeys && (() => {
                      const without = sealedKeys.members.filter(m => !m.public_key).length;
                      return without ? <> {without} member{without === 1 ? ' hasn’t' : 's haven’t'} set up secure access yet: they can read it once they do and another member opens it.</> : null;
                    })()}
                  </span>
                )}
              </span>
            </label>
          )}
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
        <div className="rounded-2xl border border-slate-800 bg-dr-card p-10 text-center text-sm text-slate-500">
          No discussions yet.{data.canPost ? ' Start the first one.' : ''}
        </div>
      ) : (() => {
        const pinned = data.threads.filter(t => t.pinned), rest = data.threads.filter(t => !t.pinned);
        const pinnedNew = pinned.reduce((n, t) => n + t.new_count, 0);
        return (
          <>
            {pinned.length > 0 && (
              <section className="rounded-2xl border border-amber-500/25 bg-dr-card overflow-hidden">
                <button onClick={() => setPinnedOpen(o => !o)} aria-expanded={pinnedOpen}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-100 hover:bg-slate-800/40 transition-colors">
                  <span className={`text-xs text-slate-500 transition-transform ${pinnedOpen ? 'rotate-90' : ''}`}>▶</span>
                  <span className="text-amber-400">📌</span>
                  <span className="flex-1">Pinned ({pinned.length})</span>
                  <NewBadge n={pinnedNew} />
                </button>
                {pinnedOpen && <ul className="divide-y divide-slate-800/60 border-t border-slate-800/60">{pinned.map(row)}</ul>}
              </section>
            )}
            {rest.length > 0 && (
              <ul className="divide-y divide-slate-800/60 rounded-2xl border border-slate-800 bg-dr-card overflow-hidden">
                {rest.map(row)}
              </ul>
            )}
          </>
        );
      })()}
    </div>
  );
}
