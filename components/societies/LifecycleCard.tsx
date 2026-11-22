'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDownload } from '@/components/MyData';

const SENTENCE = 'I CONFIRM TO DELETE THE SOCIETY UNDERSTANDING ALL CONTENT WILL BE ERASED FOR EVER';
const norm = (v: string) => v.trim().replace(/\s+/g, ' ').toUpperCase();

// Manage Society: close (hide) or reopen the Society, or delete it for good
// after two confirmations.
export default function LifecycleCard({ id, name, status, blocked, onChanged }: {
  id: number; name: string; status: string; blocked: string | null; onChanged: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [typed, setTyped] = useState('');
  const closed = status === 'closed';
  const dl = useDownload();
  const exportBtn = (
    <button onClick={() => dl.download('soc', `/api/manage/societies/${id}/export`)} disabled={!!dl.busy}
      className="rounded-lg border border-blue-500/50 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/10 disabled:opacity-50">
      {dl.busy ? 'Preparing…' : 'Download everything (.zip)'}
    </button>
  );

  async function setOpen(open: boolean) {
    if (!open && !confirm(`Close “${name}”?\n\nIt disappears from every menu and list, and members can no longer open it. Nothing is deleted, and you can reopen it here at any time.`)) return;
    setBusy(true); setError('');
    const r = await fetch(`/api/manage/societies/${id}/lifecycle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: open ? 'reopen' : 'close' }) });
    setBusy(false);
    if (!r.ok) { setError((await r.json().catch(() => ({}))).error ?? 'Couldn’t update the Society'); return; }
    onChanged();
  }
  async function remove() {
    setBusy(true); setError('');
    const r = await fetch(`/api/manage/societies/${id}/lifecycle`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmed: true, sentence: typed }) });
    setBusy(false);
    if (!r.ok) { setError((await r.json().catch(() => ({}))).error ?? 'Couldn’t delete the Society'); return; }
    setStep(0);
    router.replace('/dashboard/societies');
    router.refresh();
    window.location.assign('/dashboard/societies');
  }

  return (
    <div className="rounded-2xl border border-rose-500/30 bg-dr-card p-5">
      <h2 className="mb-1 text-sm font-semibold text-rose-200">Export, close or delete this Society</h2>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-xs text-slate-400">
          <span className="font-semibold text-slate-200">Export</span> downloads everything in the Society as one .zip: settings, members,
          debates, discussions, documents and files, events, polls, projects, news and principles (members’ private personal tasks aren’t included).
        </p>
        {exportBtn}
      </div>
      {dl.error && <p className="-mt-2 mb-3 text-xs text-rose-400">{dl.error.text}</p>}
      {blocked ? <p className="border-t border-slate-700/60 pt-4 text-xs text-slate-400">{blocked}</p> : (
        <div className="space-y-4 border-t border-slate-700/60 pt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="max-w-xl text-xs text-slate-400">
              {closed
                ? <><span className="font-semibold text-amber-300">Closed.</span> The Society is hidden from every menu and list, and only its Society Admins can open it. Reopen it to bring it back exactly as it was.</>
                : <><span className="font-semibold text-slate-200">Close</span> hides the Society from every menu and list, and stops members opening it. Nothing is deleted: you can reopen it here at any time.</>}
            </p>
            <button onClick={() => setOpen(closed)} disabled={busy}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${closed ? 'border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10' : 'border-amber-500/50 text-amber-300 hover:bg-amber-500/10'}`}>
              {closed ? 'Reopen Society' : 'Close Society'}
            </button>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3 border-t border-slate-700/60 pt-4">
            <p className="max-w-xl text-xs text-slate-400">
              <span className="font-semibold text-rose-300">Delete</span> erases the Society and everything in it for ever: debates, discussions,
              documents and their files, events, polls, projects, tasks, news and its member list. It can’t be undone.
            </p>
            <button onClick={() => { setStep(1); setTyped(''); setError(''); }} disabled={busy}
              className="rounded-lg border border-rose-500/50 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/10 disabled:opacity-50">Delete Society…</button>
          </div>
          {error && !step && <p className="text-xs text-rose-400">{error}</p>}
        </div>
      )}

      {step > 0 && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
          <div role="dialog" aria-modal="true" aria-label="Delete Society" className="w-full space-y-4 rounded-t-2xl border border-rose-500/40 bg-dr-card p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl">
            <h3 className="text-base font-semibold text-rose-200">Delete “{name}”?</h3>
            {step === 1 ? (
              <>
                <p className="text-sm text-slate-300">This permanently erases the Society and <strong>everything</strong> in it, for every member:</p>
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-400">
                  <li>its debates, with every argument, vote and chat message;</li>
                  <li>discussions, documents and uploaded files, notes and share links;</li>
                  <li>events and responses, polls and their results, projects and tasks;</li>
                  <li>news, principles, members, invitations and keys.</li>
                </ul>
                <p className="text-sm text-slate-300">There is no undo and no backup to restore from. If you only want to hide it, <strong>close</strong> it instead.</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">Keep a copy first? {exportBtn}</div>
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
                {error && <p className="text-xs text-rose-400">{error}</p>}
                <div className="flex flex-wrap gap-2">
                  <button onClick={remove} disabled={busy || norm(typed) !== SENTENCE}
                    className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-40">{busy ? 'Deleting…' : 'Delete for ever'}</button>
                  <button onClick={() => setStep(0)} disabled={busy} className="px-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
