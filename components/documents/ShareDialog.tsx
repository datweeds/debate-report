'use client';

import { useCallback, useEffect, useState } from 'react';
import { makeShareCopy } from '@/lib/sealed/shareLink';
import { refUrl, REF_NAME } from '@/lib/refs';

type Share = {
  id: string; mode: 'public' | 'private'; created_at: string; expires_at: string | null;
  open_count: number; last_opened_at: string | null; created_by: string | null; state: 'ok' | 'expired' | 'not-allowed';
};
type Doc = { id: string; kind: 'file' | 'link' | 'note'; title: string; file_name: string | null; mime_type: string | null; protection: 'server' | 'sealed' };

const CAP = 14;
const ALL_DAYS: (number | null)[] = [1, 3, 7, 14, 30, 90, null];
const dayLabel = (d: number | null) => (d == null ? 'Never expires' : d === 1 ? '1 day' : `${d} days`);
const when = (d: string) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const inputCls = 'rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none';

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

// Sharing one document. Inside new.vote: its reference, to paste into a note,
// event or discussion message (shown there as a chip that opens a preview).
// Outside (moderators, files only): share links, public or private with the key
// in the link. A new link is shown once (and copied); only its hash is kept.
export default function ShareDialog({ base, society, doc, outside, plainBytes, onClose }: {
  base: string; society: number; doc: Doc; outside: boolean; plainBytes: () => Promise<Uint8Array>; onClose: () => void;
}) {
  const refKind = doc.kind === 'note' ? 'note' as const : 'doc' as const;
  const refLink = refUrl({ society, kind: refKind, id: doc.id });
  const url = `${base}/documents/${doc.id}/shares`;
  const sealed = doc.protection === 'sealed';
  const [shares, setShares] = useState<Share[] | null>(null);
  const [privateSociety, setPrivateSociety] = useState(false);
  const [mode, setMode] = useState<'public' | 'private'>(sealed ? 'private' : 'public');
  const [days, setDays] = useState<number | null>(14);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [made, setMade] = useState<{ link: string; key: string | null; copied: boolean } | null>(null);
  const [copiedWhat, setCopiedWhat] = useState('');

  const capped = (m: 'public' | 'private') => m === 'public' && privateSociety;
  const daysFor = (m: 'public' | 'private') => ALL_DAYS.filter(d => !capped(m) || (d != null && d <= CAP));

  const load = useCallback(async () => {
    const r = await fetch(url);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error ?? 'Couldn’t load the links'); return; }
    setShares(d.shares); setPrivateSociety(d.privateSociety);
  }, [url]);
  useEffect(() => { if (outside) load(); }, [load, outside]);
  // Keep the chosen expiry within what this kind of link allows
  useEffect(() => { if (capped(mode) && (days == null || days > CAP)) setDays(CAP); }, [mode, privateSociety]); // eslint-disable-line react-hooks/exhaustive-deps

  async function create() {
    setBusy(true); setError(''); setMade(null);
    try {
      let r: Response, key: string | null = null;
      if (mode === 'private') {
        const made = makeShareCopy(await plainBytes(), { name: doc.file_name || doc.title, type: doc.mime_type || 'application/octet-stream', title: doc.title });
        key = made.key;
        const form = new FormData();
        form.set('mode', 'private'); form.set('days', days == null ? 'never' : String(days));
        form.set('copy', new Blob([new Uint8Array(made.copy)]), 'copy.sns');
        r = await fetch(url, { method: 'POST', body: form });
      } else {
        r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, days: days ?? 'never' }) });
      }
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? 'Couldn’t make the link');
      const link = `${window.location.origin}/s/${d.token}${key ? `#${key}` : ''}`;
      setMade({ link, key, copied: await copy(link) });
      await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function extend(s: Share, d: string) {
    setError('');
    const r = await fetch(`${url}/${s.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days: d }) });
    if (!r.ok) setError((await r.json().catch(() => ({}))).error ?? 'Couldn’t extend the link');
    await load();
  }
  async function revoke(s: Share) {
    if (!confirm('Revoke this link? Anyone who has it won’t be able to open the document any more.')) return;
    await fetch(`${url}/${s.id}`, { method: 'DELETE' });
    await load();
  }
  async function copyPart(text: string, what: string) { if (await copy(text)) { setCopiedWhat(what); setTimeout(() => setCopiedWhat(''), 2000); } }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-10">
      <div className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-700 bg-dr-card p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 text-base font-semibold text-slate-100 break-words">Share “{doc.title}”</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300" aria-label="Close">✕</button>
        </div>
        {/* Inside new.vote */}
        <div className="space-y-2 rounded-xl border border-slate-800 p-3">
          <p className="text-sm font-medium text-slate-100">📎 Reference it inside new.vote</p>
          <p className="text-xs text-slate-400">
            Paste this into a note, an event or a discussion message in this Society (or use the 📎 button there).
            Readers see the {REF_NAME[refKind]}’s name, and clicking it opens a preview with a link to it here.
            Only people who can open this {REF_NAME[refKind]} see its name.
          </p>
          <div className="flex gap-2">
            <input readOnly value={refLink} onFocus={e => e.target.select()} aria-label="Reference" className={`${inputCls} min-w-0 flex-1 font-mono text-xs`} />
            <button onClick={() => copyPart(refLink, 'ref')} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-blue-500/60 hover:bg-blue-500/10">
              {copiedWhat === 'ref' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {outside && (<>
        <p className="text-xs text-slate-400">A link lets people outside this Society open this document, without an account.</p>

        {/* New link */}
        <div className="space-y-3 rounded-xl border border-slate-800 p-3">
          <label className={`flex gap-2 text-sm ${sealed ? 'opacity-50' : ''}`}>
            <input type="radio" checked={mode === 'public'} disabled={sealed} onChange={() => setMode('public')} className="mt-1" />
            <span><span className="font-medium text-slate-100">Anyone with the link</span>
              <span className="block text-xs text-slate-400">
                {sealed ? 'Not for sealed documents: new.vote can’t read them to serve them.'
                  : `Whoever has the link can open it.${privateSociety ? ` In a private Society it must expire within ${CAP} days; you can extend it later.` : ''}`}
              </span></span>
          </label>
          <label className="flex gap-2 text-sm">
            <input type="radio" checked={mode === 'private'} onChange={() => setMode('private')} className="mt-1" />
            <span><span className="font-medium text-slate-100">🔐 Private link</span>
              <span className="block text-xs text-slate-400">
                Your browser encrypts a copy with a key that’s only in the link, so new.vote can’t read it. Send the whole link, or the link and key separately.
                It shares the document as it is now: later edits aren’t included.
              </span></span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select value={days == null ? 'never' : String(days)} onChange={e => setDays(e.target.value === 'never' ? null : Number(e.target.value))} className={inputCls}>
              {daysFor(mode).map(d => <option key={String(d)} value={d == null ? 'never' : String(d)}>{dayLabel(d)}</option>)}
            </select>
            <button onClick={create} disabled={busy} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
              {busy ? (mode === 'private' ? 'Encrypting…' : 'Making link…') : 'Create link and copy'}
            </button>
          </div>
        </div>

        {made && (
          <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="text-xs font-semibold text-emerald-300">{made.copied ? '✓ Link copied to the clipboard' : 'Link made: copy it now'}</p>
            <input readOnly value={made.link} onFocus={e => e.target.select()} className={`${inputCls} w-full font-mono text-xs`} />
            <div className="flex flex-wrap gap-3 text-xs">
              <button onClick={() => copyPart(made.link, 'link')} className="text-blue-300 hover:text-blue-200">Copy link</button>
              {made.key && <>
                <button onClick={() => copyPart(made.link.split('#')[0], 'nokey')} className="text-blue-300 hover:text-blue-200">Copy link without key</button>
                <button onClick={() => copyPart(made.key!, 'key')} className="text-blue-300 hover:text-blue-200">Copy key only</button>
              </>}
              {copiedWhat && <span className="text-emerald-300">Copied</span>}
            </div>
            <p className="text-[11px] text-slate-400">
              This is the only time the link is shown: new.vote keeps just a fingerprint of it{made.key ? ', and never sees the key' : ''}. If it’s lost, make a new one.
              {made.key ? ' Sending the key separately (by text or Signal, say) means neither message alone opens it.' : ''}
            </p>
          </div>
        )}

        {error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}

        {/* Existing links */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Links</p>
          {!shares ? <div className="h-10 animate-pulse rounded-lg bg-slate-800/40" />
            : !shares.length ? <p className="text-xs text-slate-500">No links yet.</p>
            : shares.map(s => (
              <div key={s.id} className="space-y-1.5 rounded-lg border border-slate-800 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-200">{s.mode === 'private' ? '🔐 Private link' : 'Anyone with the link'}</span>
                  <span className={s.state === 'ok' ? 'text-slate-400' : 'text-amber-300'}>
                    {s.state === 'not-allowed' ? 'Stopped (document now sealed)' : s.state === 'expired' ? 'Expired' : s.expires_at ? `Expires ${when(s.expires_at)}` : 'Never expires'}
                  </span>
                </div>
                <p className="text-slate-500">
                  {s.created_by ? `@${s.created_by} · ` : ''}made {when(s.created_at)} · opened {s.open_count} time{s.open_count === 1 ? '' : 's'}
                  {s.last_opened_at ? `, last ${when(s.last_opened_at)}` : ''}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {s.state !== 'not-allowed' && (
                    <select value="" onChange={e => e.target.value && extend(s, e.target.value)} className={`${inputCls} py-1 text-xs`}>
                      <option value="">Extend…</option>
                      {daysFor(s.mode).map(d => <option key={String(d)} value={d == null ? 'never' : String(d)}>{d == null ? 'Never expires' : `${dayLabel(d)} from now`}</option>)}
                    </select>
                  )}
                  <button onClick={() => revoke(s)} className="text-rose-400 hover:text-rose-300">Revoke</button>
                </div>
              </div>
            ))}
        </div>
        </>)}
      </div>
    </div>
  );
}
