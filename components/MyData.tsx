'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

const SENTENCE = 'I CONFIRM TO DELETE MY ACCOUNT UNDERSTANDING IT CANNOT BE UNDONE';
const norm = (v: string) => v.trim().replace(/\s+/g, ' ').toUpperCase();

type Info = {
  handle: string; paid: boolean;
  societies: { id: number; name: string; status: string | null }[];
  blockers: { message: string; societyId?: number }[];
};

// Fetch an export and save it, showing progress and any error in place
export function useDownload() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; text: string } | null>(null);
  const download = useCallback(async (key: string, url: string) => {
    setBusy(key); setError(null);
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Couldn’t prepare the download');
      const name = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') ?? '')?.[1] ?? 'export.zip';
      const href = URL.createObjectURL(await r.blob());
      const a = Object.assign(document.createElement('a'), { href, download: name });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 60_000);
    } catch (e) {
      setError({ key, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }, []);
  return { busy, error, download };
}

const card = 'rounded-2xl border border-blue-900/30 bg-dr-card p-5';
const btn = 'rounded-lg border border-blue-500/50 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/10 disabled:opacity-50';

export default function MyData() {
  const [info, setInfo] = useState<Info | null>(null);
  const [loadError, setLoadError] = useState('');
  const { busy, error, download } = useDownload();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [delError, setDelError] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/user/account', { cache: 'no-store' });
    if (!r.ok) { setLoadError('Couldn’t load your account. Please refresh.'); return; }
    setInfo(await r.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function remove() {
    setDeleting(true); setDelError('');
    const r = await fetch('/api/user/account', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmed: true, sentence: typed }),
    });
    if (!r.ok) {
      setDeleting(false);
      setDelError((await r.json().catch(() => ({}))).error ?? 'Couldn’t delete your account');
      load();
      return;
    }
    window.location.assign('/?account=deleted');
  }

  if (loadError) return <main className="mx-auto max-w-3xl px-4 py-8 text-sm text-rose-400">{loadError}</main>;
  if (!info) return <main className="mx-auto max-w-3xl px-4 py-8 text-sm text-slate-500">Loading…</main>;

  return (
    <main className="w-full max-w-4xl space-y-5 px-4 py-6 sm:px-6 lg:px-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Your data</h1>
        <p className="mt-1 text-sm text-slate-400">Download a copy of everything you’ve put into new.vote, export the Societies you run, or delete your account.</p>
      </div>

      {/* ── Personal export ── */}
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-xl">
            <h2 className="text-sm font-semibold text-slate-200">Download your data</h2>
            <p className="mt-1 text-xs text-slate-400">
              One .zip file with your account and profile, your Society memberships, and everything you’ve made or done here:
              arguments and votes, discussion posts, documents you uploaded, events, polls, tasks, requests and more.
              The files are JSON, readable by people and by other software.
            </p>
          </div>
          <button onClick={() => download('me', '/api/user/export')} disabled={!!busy} className={btn}>
            {busy === 'me' ? 'Preparing…' : 'Download my data'}
          </button>
        </div>
        {error?.key === 'me' && <p className="mt-2 text-xs text-rose-400">{error.text}</p>}
      </section>

      {/* ── Society exports, for Society Admins ── */}
      {info.societies.length > 0 && (
        <section className={card}>
          <h2 className="text-sm font-semibold text-slate-200">Societies you run</h2>
          <p className="mt-1 max-w-xl text-xs text-slate-400">
            As a Society Admin you can download everything in a Society: its settings, members, debates, discussions,
            documents and files, events, polls, projects, news and principles. Members’ private personal tasks aren’t included.
          </p>
          <ul className="mt-3 divide-y divide-slate-800">
            {info.societies.map(s => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0 text-sm text-slate-200">
                  {s.name}
                  {s.status === 'closed' && <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300">Closed</span>}
                </span>
                <span className="flex items-center gap-2">
                  {error?.key === `s${s.id}` && <span className="text-xs text-rose-400">{error.text}</span>}
                  <button onClick={() => download(`s${s.id}`, `/api/manage/societies/${s.id}/export`)} disabled={!!busy} className={btn}>
                    {busy === `s${s.id}` ? 'Preparing…' : 'Download'}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Delete account ── */}
      <section className="rounded-2xl border border-rose-500/30 bg-dr-card p-5">
        <h2 className="text-sm font-semibold text-rose-200">Delete your account</h2>
        <div className="mt-2 space-y-2 text-xs text-slate-400">
          <p><span className="font-semibold text-slate-300">Erased:</span> your profile, name, email and sign-in methods (passkeys, Nostr key, password),
            your Society memberships, personal tasks and categories, event responses, favourites, requests and notification settings.</p>
          <p><span className="font-semibold text-slate-300">Kept, but no longer linked to you:</span> what you contributed to shared spaces (arguments in debates,
            discussion posts, documents, votes), so other people’s replies still make sense. It will show as an anonymous “deleted-…” member
            with no name or profile. If you want any of it removed, delete it yourself first.</p>
          {info.paid && <p className="text-amber-300">Your paid plan will be cancelled straight away.</p>}
          <p>You’ll be signed out everywhere, and this can’t be undone. You may want to <button onClick={() => download('me', '/api/user/export')} className="text-blue-300 underline hover:text-blue-200">download your data</button> first.</p>
        </div>
        {info.blockers.length > 0 ? (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <p className="font-semibold">Before you can delete your account:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {info.blockers.map((b, i) => (
                <li key={i}>{b.message}{b.societyId && <> <Link href={`/dashboard/societies?society=${b.societyId}`} className="underline hover:text-amber-100">Manage Society →</Link></>}</li>
              ))}
            </ul>
          </div>
        ) : (
          <button onClick={() => { setStep(1); setTyped(''); setDelError(''); }}
            className="mt-3 rounded-lg border border-rose-500/50 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/10">Delete my account…</button>
        )}
      </section>

      {step > 0 && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
          <div role="dialog" aria-modal="true" aria-label="Delete your account" className="w-full space-y-4 rounded-t-2xl border border-rose-500/40 bg-dr-card p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl">
            <h3 className="text-base font-semibold text-rose-200">Delete your account @{info.handle}?</h3>
            {step === 1 ? (
              <>
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-400">
                  <li>Your profile, email, sign-in methods and memberships are erased.</li>
                  <li>Your personal tasks, categories, responses and settings are erased.</li>
                  <li>Your contributions to debates, discussions and documents stay, shown as an anonymous deleted member.</li>
                  {info.paid && <li className="text-amber-300">Your paid plan is cancelled.</li>}
                </ul>
                <p className="text-sm text-slate-300">There is no undo, and you can’t sign in to this account again.</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setStep(2)} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500">I understand, continue</button>
                  <button onClick={() => setStep(0)} className="px-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-300">To confirm, type the following sentence:</p>
                <p className="select-none rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 font-mono text-xs leading-relaxed text-rose-200">{SENTENCE}</p>
                <textarea value={typed} onChange={e => setTyped(e.target.value)} rows={3} aria-label="Confirmation sentence" autoFocus
                  onPaste={e => e.preventDefault()} spellCheck={false}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100 focus:border-rose-500 focus:outline-none" />
                {delError && <p className="text-xs text-rose-400">{delError}</p>}
                <div className="flex flex-wrap gap-2">
                  <button onClick={remove} disabled={deleting || norm(typed) !== SENTENCE}
                    className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-40">{deleting ? 'Deleting…' : 'Delete my account for ever'}</button>
                  <button onClick={() => setStep(0)} disabled={deleting} className="px-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
