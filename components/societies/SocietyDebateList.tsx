'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SecureAccessDialog from '@/components/sealed/SecureAccessDialog';
import { useSecureAccess } from '@/components/sealed/useSecureAccess';
import { newItemKeys, openItemText, sealItemText, societyMembers } from '@/components/sealed/items';
import { debateKeys, openDebateTitles } from '@/components/chamber/sealedDebate';

type Debate = { id: string; stat_title: string; vote_for: number; vote_against: number; child_count: number };
type Text = { k: string; id: string; v: string };

// A Society's debates, with their titles opened in the browser when the
// Society has sealed its debates, and the moderators' Seal / Unseal controls.
export default function SocietyDebateList({ societyId, debates, sealedId, canSeal, canModerate, emptyText }: {
  societyId: number; debates: Debate[]; sealedId: string | null; canSeal: boolean; canModerate: boolean; emptyText: string;
}) {
  const router = useRouter();
  const access = useSecureAccess();
  const [shown, setShown] = useState<Debate[] | null>(sealedId ? null : debates);
  const [hasKey, setHasKey] = useState(false);
  const [dialog, setDialog] = useState<'setup' | 'unlock' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const base = `/api/societies/${societyId}`;

  useEffect(() => {
    if (!sealedId) { setShown(debates); return; }
    if (access.status === 'loading') return;
    openDebateTitles(debates.map(d => ({ ...d, customer_id: societyId, sealed_id: sealedId }))).then(setShown);
    if (access.identity) debateKeys(societyId, sealedId).then(k => setHasKey(!!k?.keys.size));
  }, [debates, sealedId, societyId, access.status, access.identity]);

  async function texts(): Promise<Text[]> {
    const r = await fetch(`${base}/debates/seal?texts=1`);
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Couldn’t load the debates');
    return (await r.json()).texts;
  }
  async function post(body: object, failed: string) {
    const r = await fetch(`${base}/debates/seal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? failed);
  }

  async function sealAll() {
    if (!confirm('Seal all this Society’s debates? Every argument, chat message, reason given with a vote and closing statement, in every debate here (and every new one), will be encrypted in members’ browsers, so only members can read them, not new.vote. AI features (Argue, evidence analysis, quality reports) are off while sealed, and debates can’t be moved or copied to other Societies. Who voted which way stays visible to the server, but not what on. Members need secure access to read them.')) return;
    if (access.status !== 'ready') { setDialog(access.status === 'locked' ? 'unlock' : 'setup'); return; }
    setBusy(true); setError('');
    try {
      const [all, { members }] = await Promise.all([texts(), societyMembers(base)]);
      const itemId = crypto.randomUUID();
      const { keys, locks } = newItemKeys('debates', itemId, members);
      await post({ action: 'seal', itemId, locks, texts: all.map(t => ({ ...t, v: sealItemText(keys, t.v) })) }, 'Couldn’t seal the debates');
      router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function unsealAll() {
    if (!sealedId || !confirm('Unseal this Society’s debates? They go back to being encrypted on the server with the Society’s key, so AI features, scanning and Sys Admin emergency access can reach them again.')) return;
    setBusy(true); setError('');
    try {
      const keys = await debateKeys(societyId, sealedId);
      if (!keys) throw new Error('Unlock secure access first');
      const all = (await texts()).map(t => ({ ...t, v: openItemText(keys, t.v) }));
      if (all.some(t => t.v == null)) throw new Error('Some debate text can’t be opened with your keys, so the debates can’t be unsealed from here');
      await post({ action: 'unseal', texts: all }, 'Couldn’t unseal the debates');
      router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      {dialog && <SecureAccessDialog mode={dialog} onDone={() => setDialog(null)} onClose={() => setDialog(null)} />}
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-xs font-semibold text-slate-600 uppercase tracking-wider">Select a debate</p>
        {canSeal && !sealedId && (
          <button onClick={sealAll} disabled={busy} title="End-to-end encrypt all this Society’s debates"
            className="rounded-lg border border-emerald-600/50 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50">
            {busy ? 'Sealing…' : '🔐 Seal debates'}
          </button>
        )}
      </div>
      {sealedId && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs text-slate-300">
          <span className="font-semibold text-emerald-300">🔐 Sealed debates:</span> arguments, chat, reasons for votes and closing statements are end-to-end
          encrypted, so only members can read them, not new.vote. Who voted which way is still visible to the server, but not what on. AI features are off.
          {access.status === 'none' && <> <button onClick={() => setDialog('setup')} className="font-semibold text-blue-300 hover:underline">Set up secure access</button> to read them.</>}
          {access.status === 'locked' && <> <button onClick={() => setDialog('unlock')} className="font-semibold text-blue-300 hover:underline">Unlock secure access</button> on this device to read them.</>}
          {access.status === 'ready' && shown && !hasKey && <span className="text-amber-200"> Waiting for access: another member’s browser shares the key next time they open a debate here.</span>}
          {canModerate && hasKey && <> <button onClick={unsealAll} disabled={busy} className="text-slate-400 hover:text-slate-200 hover:underline">{busy ? 'Unsealing…' : 'Unseal'}</button></>}
        </div>
      )}
      {error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
      {debates.length === 0 ? (
        <p className="text-sm text-slate-500 italic">{emptyText}</p>
      ) : !shown ? (
        <div className="h-24 rounded-2xl bg-slate-800/40 animate-pulse" />
      ) : (
        <div className="divide-y divide-slate-800/60 rounded-2xl border border-slate-800 bg-dr-card overflow-hidden">
          {shown.map(d => (
            <Link key={d.id} href={`/chamber?resolution=${d.id}`}
              className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-800/40 transition-colors">
              <span className="text-sm text-slate-200">{d.stat_title}</span>
              <span className="flex items-center gap-3 text-xs text-slate-500 flex-shrink-0">
                <span className="text-emerald-500">{d.vote_for}↑</span>
                <span className="text-rose-500">{d.vote_against}↓</span>
                <span>{d.child_count} statements</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
