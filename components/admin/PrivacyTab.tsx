'use client';

import { useCallback, useEffect, useState } from 'react';
import MasterKeyCard from './MasterKeyCard';

type Society = { id: number; name: string; visibility: string; my_grant_until: string | null };
type Entry = { id: string; society: string; sysadmin: string | null; reason: string; created_at: string; expires_at: string; ended_at: string | null };

const fmt = (d: string) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// SysAdmin: emergency ("break-glass") access to private Societies
export default function PrivacyTab() {
  const [data, setData] = useState<{ societies: Society[]; log: Entry[]; minutes: number } | null>(null);
  const [openFor, setOpenFor] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/break-glass');
    if (r.ok) setData(await r.json());
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function grant(id: number) {
    setError('');
    const r = await fetch('/api/admin/break-glass', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ societyId: id, reason }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error ?? 'Could not open access.'); return; }
    setOpenFor(null); setReason('');
    window.location.href = `/society/${id}`;
  }

  async function end(id: number) {
    await fetch('/api/admin/break-glass', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ societyId: id }) });
    await load();
  }

  if (!data) return <div className="h-24 rounded-xl bg-slate-800/40 animate-pulse" />;
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">
        You have no routine access to a private Society’s content: its discussions, documents, debates, chat, or the text of its flagged content.
        Their stored content is encrypted with the Society’s own key. In an emergency, such as a serious report or a legal request, open time-limited access ({data.minutes} minutes) with a reason.
        The Society’s moderators see every access in their log, and its contact address is emailed straight away.
      </p>

      <MasterKeyCard />

      <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Private Societies</h2>
        {data.societies.length === 0 && <p className="text-xs text-slate-500">There are no private Societies.</p>}
        <ul className="divide-y divide-slate-800/60">
          {data.societies.map(s => (
            <li key={s.id} className="py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-slate-200">{s.name} <span className="text-xs text-slate-500">{s.visibility === 'invite' ? 'invitation only' : 'by request'}</span></span>
                {s.my_grant_until ? (
                  <span className="flex items-center gap-3 text-xs">
                    <span className="text-amber-300">Your access ends {fmt(s.my_grant_until)}</span>
                    <a href={`/society/${s.id}`} className="text-blue-400 hover:underline">Open</a>
                    <button onClick={() => end(s.id)} className="text-rose-300 hover:underline">End now</button>
                  </span>
                ) : (
                  <button onClick={() => { setOpenFor(openFor === s.id ? null : s.id); setReason(''); setError(''); }}
                    className="rounded-lg border border-amber-500/40 px-3 py-1 text-xs text-amber-300 hover:bg-amber-500/10">Emergency access…</button>
                )}
              </div>
              {openFor === s.id && (
                <div className="mt-2 space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <label className="block text-xs text-slate-300">Reason (shown to the Society’s moderators and emailed to them)</label>
                  <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} maxLength={1000}
                    placeholder="e.g. Investigating a report of threats made in a discussion, ref #123"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
                  <div className="flex items-center gap-3">
                    <button onClick={() => grant(s.id)} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500">Open access for {data.minutes} minutes</button>
                    {error && <span className="text-xs text-rose-300">{error}</span>}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Access log</h2>
        {data.log.length === 0 ? <p className="text-xs text-slate-500">No emergency access yet.</p> : (
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500"><tr><th className="py-1 font-normal">When</th><th className="font-normal">Society</th><th className="font-normal">By</th><th className="font-normal">Reason</th><th className="font-normal">Until</th></tr></thead>
            <tbody className="text-slate-300">
              {data.log.map(e => (
                <tr key={e.id} className="border-t border-slate-800/60 align-top">
                  <td className="py-1.5 pr-2 whitespace-nowrap">{fmt(e.created_at)}</td><td className="pr-2">{e.society}</td>
                  <td className="pr-2">@{e.sysadmin ?? '?'}</td><td className="pr-2">{e.reason}</td>
                  <td className="whitespace-nowrap">{fmt(e.ended_at ?? e.expires_at)}{e.ended_at && ' (ended)'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
