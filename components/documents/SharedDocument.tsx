'use client';

import ReportButton from '@/components/ReportButton';
import { useCallback, useEffect, useState } from 'react';
import { openShareCopy, type SharedDetails } from '@/lib/sealed/shareLink';

type Meta = {
  mode: 'public' | 'private'; society: string; sharedBy: string | null; expiresAt: string | null; size: number;
  title?: string; fileName?: string; mimeType?: string;
};
const INLINE = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'text/plain']);

function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(/\.0$/, '')} MB`;
}
const when = (d: string) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const btn = 'rounded-lg px-4 py-2 text-sm font-semibold';

// A shared document. Public links are served as they are; private links come
// encrypted and are opened here with the key from the link (after '#').
export default function SharedDocument({ token }: { token: string }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState('');
  const [key, setKey] = useState('');
  const [typed, setTyped] = useState('');
  const [opened, setOpened] = useState<{ details: SharedDetails; url: string; size: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileUrl = `/api/shared/${token}/file`;

  useEffect(() => {
    setKey(decodeURIComponent(window.location.hash.slice(1)));
    fetch(`/api/shared/${token}`).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (r.ok) setMeta(d); else setError(d.error ?? 'This link doesn’t work');
    }).catch(() => setError('Couldn’t reach new.vote'));
  }, [token]);

  const openPrivate = useCallback(async (k: string) => {
    setBusy(true); setError('');
    try {
      const r = await fetch(fileUrl);
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Couldn’t fetch the document');
      let res;
      try { res = openShareCopy(new Uint8Array(await r.arrayBuffer()), k); } catch { throw new Error('That key doesn’t open this document. Check you have the whole link or key.'); }
      const url = URL.createObjectURL(new Blob([new Uint8Array(res.file)], { type: res.details.type || 'application/octet-stream' }));
      setOpened({ details: res.details, url, size: res.file.length });
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }, [fileUrl]);

  // With the key in the link, open straight away
  useEffect(() => { if (meta?.mode === 'private' && key && !opened) void openPrivate(key); }, [meta, key, opened, openPrivate]);

  const save = (url: string, name: string) => { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); };

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="space-y-4 rounded-2xl border border-slate-800 bg-dr-card p-6">
        {!meta && !error && <div className="h-24 animate-pulse rounded-xl bg-slate-800/40" />}
        {meta && (
          <p className="text-xs text-slate-400">
            Shared from <span className="font-semibold text-slate-200">{meta.society}</span>{meta.sharedBy ? <> by @{meta.sharedBy}</> : null}
            {meta.expiresAt && <> · link expires {when(meta.expiresAt)}</>}
          </p>
        )}
        {meta && <div><ReportButton kind="document" id="" share={token} what="this document" /></div>}

        {meta?.mode === 'public' && (
          <>
            <div>
              <h1 className="text-lg font-semibold text-slate-100 break-words">{meta.title}</h1>
              <p className="text-xs text-slate-500 break-all">{meta.fileName} · {bytes(meta.size)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {INLINE.has(meta.mimeType ?? '') && <a href={fileUrl} target="_blank" rel="noopener noreferrer" className={`${btn} bg-blue-600 text-white hover:bg-blue-500`}>Open</a>}
              <a href={`${fileUrl}?download=1`} className={`${btn} border border-slate-700 text-slate-200 hover:bg-slate-800`}>Download</a>
            </div>
          </>
        )}

        {meta?.mode === 'private' && !opened && (
          <>
            <div>
              <h1 className="text-lg font-semibold text-slate-100">🔐 Private document</h1>
              <p className="mt-1 text-xs text-slate-400">
                It’s encrypted, and opened here in your browser with the key from your link. new.vote never has the key and can’t read it.
              </p>
            </div>
            {busy ? <p className="text-sm text-slate-300">Opening…</p> : (
              <form onSubmit={e => { e.preventDefault(); if (typed.trim()) void openPrivate(typed.trim()); }} className="space-y-2">
                <label className="block text-xs text-slate-400">{key ? 'Try the key again, or paste it here:' : 'Paste the key you were sent:'}</label>
                <input value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" spellCheck={false}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 focus:border-blue-500 focus:outline-none" />
                <button className={`${btn} bg-blue-600 text-white hover:bg-blue-500`}>Open document</button>
              </form>
            )}
          </>
        )}

        {opened && (
          <>
            <div>
              <h1 className="text-lg font-semibold text-slate-100 break-words">🔐 {opened.details.title}</h1>
              <p className="text-xs text-slate-500 break-all">{opened.details.name} · {bytes(opened.size)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {INLINE.has(opened.details.type) && <a href={opened.url} target="_blank" rel="noopener noreferrer" className={`${btn} bg-blue-600 text-white hover:bg-blue-500`}>Open</a>}
              <button onClick={() => save(opened.url, opened.details.name || 'document')} className={`${btn} border border-slate-700 text-slate-200 hover:bg-slate-800`}>Download</button>
            </div>
          </>
        )}

        {error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}
      </div>
      <p className="text-center text-[11px] text-slate-500">
        Shared by a member of a Society on <a href="/" className="hover:text-slate-300">new.vote</a>. No account is needed to view it.
      </p>
    </div>
  );
}
