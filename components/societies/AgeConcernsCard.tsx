'use client';

import { useCallback, useEffect, useState } from 'react';

type Concern = { id: string; created_at: string; decided_at: string | null; status: string; raised_as: string; note: string | null;
  item_kind: string | null; mine: boolean; user_handle: string | null };
const OUTCOME: Record<string, [string, string]> = {
  pending: ['Being reviewed by the new.vote team', 'text-amber-300'],
  no_concern: ['Reviewed: no concern', 'text-slate-300'],
  treated_16_17: ['Reviewed: treated as 16 or 17 (under-18 protections apply)', 'text-sky-300'],
  closed: ['Reviewed: under 16, account closed', 'text-rose-300'],
  checked_adult: ['Age check passed: 18 or over', 'text-emerald-300'],
  checked_16_17: ['Age check passed: 16 or 17 (under-18 protections apply)', 'text-sky-300'],
};
const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Manage society: age concerns raised here (when, why, the outcome), and raising one.
export default function AgeConcernsCard({ societyId, members }: { societyId: number; members: { user_id: string; label: string }[] }) {
  const [list, setList] = useState<Concern[] | null>(null);
  const [who, setWho] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const load = useCallback(() => fetch(`/api/manage/societies/${societyId}/age-concerns`).then(r => r.ok ? r.json() : { concerns: [] })
    .then(d => setList(d.concerns)).catch(() => setList([])), [societyId]);
  useEffect(() => { void load(); }, [load]);
  async function raise(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    const r = await fetch(`/api/manage/societies/${societyId}/age-concerns`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: who, note }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(d.error ?? 'Couldn’t send'); return; }
    setWho(''); setNote(''); setMsg('Sent to the new.vote team.'); void load();
  }
  const field = 'rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100';
  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-dr-card p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-100">Age concerns</h3>
        <p className="mt-1 text-xs text-slate-400">
          new.vote is for people aged 16 and over. If you think a member is younger, raise a concern: the new.vote team reviews it
          (and may ask them to confirm their age), and you&apos;ll see the outcome here. Members can also report a post as
          &quot;may be under 16&quot;. Don&apos;t confront the member or discuss it in the Society.
        </p>
      </div>
      <form onSubmit={raise} className="space-y-2">
        <select value={who} onChange={e => setWho(e.target.value)} className={`${field} w-full`} aria-label="Member">
          <option value="">Choose a member…</option>
          {members.map(m => <option key={m.user_id} value={m.user_id}>{m.label}</option>)}
        </select>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={1000} placeholder="Why are you concerned? (only the new.vote team and this Society's Admins see this)" className={`${field} w-full`} />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={!who || note.trim().length < 3} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-40">Raise a concern</button>
          {msg && <span className="text-xs text-slate-300">{msg}</span>}
        </div>
      </form>
      {list === null ? <div className="h-10 animate-pulse rounded bg-slate-800/40" /> : !list.length ? (
        <p className="text-xs text-slate-500">No age concerns have been raised in this Society.</p>
      ) : (
        <ul className="divide-y divide-slate-800/60">
          {list.map(c => {
            const [label, cls] = OUTCOME[c.status] ?? [c.status, 'text-slate-300'];
            return (
              <li key={c.id} className="space-y-1 py-2.5 text-xs">
                <p className="text-slate-200">
                  <span className="font-semibold">{c.user_handle ? `@${c.user_handle}` : 'A closed account'}</span>
                  <span className="text-slate-500"> · raised {fmt(c.created_at)} by {c.mine ? 'you' : c.raised_as === 'society_admin' ? 'a Society Admin' : c.raised_as === 'member' ? 'a member' : 'a visitor'}{c.item_kind ? `, reporting their ${c.item_kind}` : ''}</span>
                </p>
                {c.note && <p className="text-slate-400">Why: {c.note}</p>}
                <p className={cls}>{label}{c.decided_at ? ` · ${fmt(c.decided_at)}` : ''}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
