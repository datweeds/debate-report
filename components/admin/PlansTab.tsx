'use client';

import { useCallback, useEffect, useState } from 'react';

type Person = { id: string; handle: string; active: number; held: number; names: string; plan: string; planName: string; source: string; until: string | null;
  societiesLimit: number; storage: number; storageLimit: number; ai: number; aiLimit: number };
type Grant = { id: string; plan: string; until: string | null; reason: string; created_at: string; person: string; granted_by: string | null };
type Data = { enforced: boolean; onSale: boolean; people: Person[]; ownerless: { id: number; name: string }[]; grants: Grant[]; plans: { key: string; name: string }[] };

const bytes = (n: number) => (n >= 1024 ** 3 ? `${+(n / 1024 ** 3).toFixed(1)} GB` : n >= 1024 ** 2 ? `${Math.round(n / 1024 ** 2)} MB` : `${Math.round(n / 1024)} KB`);
const usd = (n: number) => `$${n.toFixed(2)}`;
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'no end date');

function Switch({ on, label, text, onChange }: { on: boolean; label: string; text: string; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 p-4">
      <input type="checkbox" checked={on} onChange={e => onChange(e.target.checked)} className="mt-1 h-4 w-4 accent-blue-500" />
      <span><span className="block text-sm font-semibold text-slate-200">{label}</span><span className="block text-xs text-slate-500">{text}</span></span>
    </label>
  );
}

// SysAdmin: the plan switches, each Society owner's plan and shared usage, and plans given without payment.
export default function PlansTab() {
  const [d, setD] = useState<Data | null>(null);
  const [msg, setMsg] = useState('');
  const [g, setG] = useState({ handle: '', plan: 'society_plus', until: '', reason: '' });
  const load = useCallback(async () => { const r = await fetch('/api/admin/plans'); if (r.ok) setD(await r.json()); }, []);
  useEffect(() => { void load(); }, [load]);

  async function call(method: string, body?: unknown, q = '') {
    setMsg('');
    const r = await fetch(`/api/admin/plans${q}`, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const res = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(res.error ?? 'Could not save.'); return false; }
    await load();
    return true;
  }

  if (!d) return <div className="h-24 animate-pulse rounded-xl bg-slate-800/40" />;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        <Switch on={d.enforced} label="Enforce plan limits"
          text="Off: usage is measured and shown, nothing is blocked. On: each owner is held to their plan: how many Societies, shared storage and AI, largest file, call length and size, voting codes, repeating events, formal ballots."
          onChange={v => { if (!v || confirm('Hold every Society owner to their plan’s limits now?')) void call('PUT', { enforced: v }); }} />
        <Switch on={d.onSale} label="Paid plans on sale"
          text="Shows the plans and Subscribe buttons on Plans & billing. You can always test checkout as Sys Admin."
          onChange={v => void call('PUT', { onSale: v })} />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <button onClick={() => void call('PUT', { runNow: true })} className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-slate-500">Run checks now</button>
        Every hour, while limits are enforced: warning emails at 80% and 100%, and Societies over an owner’s plan held read-only (Sys Admins exempt).
      </div>
      {msg && <p className="text-sm text-rose-300">{msg}</p>}

      <div className="rounded-2xl border border-slate-800 bg-dr-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Society owners</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="text-slate-500"><tr>
              <th className="py-1 font-normal">Owner</th><th className="font-normal">Plan</th><th className="text-right font-normal">Societies</th>
              <th className="text-right font-normal">Storage</th><th className="text-right font-normal">AI this month</th>
            </tr></thead>
            <tbody className="text-slate-300">
              {d.people.map(p => (
                <tr key={p.id} className="border-t border-slate-800/60 align-top">
                  <td className="py-1.5">@{p.handle}<div className="text-[11px] text-slate-500">{p.names}</div></td>
                  <td>{p.planName}{p.source !== 'free' && <span className="ml-1 text-slate-500">· {p.source}{p.until ? ` to ${day(p.until)}` : ''}</span>}</td>
                  <td className={`text-right tabular-nums ${p.active > p.societiesLimit ? 'text-amber-300' : ''}`}>{p.active} / {p.societiesLimit}{p.held ? <span className="text-amber-300"> (+{p.held} read-only)</span> : ''}</td>
                  <td className={`text-right tabular-nums ${p.storage > p.storageLimit ? 'text-amber-300' : ''}`}>{bytes(p.storage)} / {bytes(p.storageLimit)}</td>
                  <td className={`text-right tabular-nums ${p.ai > p.aiLimit ? 'text-amber-300' : ''}`}>{usd(p.ai)} / {usd(p.aiLimit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d.ownerless.length > 0 && <p className="mt-3 text-xs text-slate-500">No owner (each stands alone on Huddle): {d.ownerless.map(s => s.name).join(', ')}.</p>}
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-800 bg-dr-card p-5">
        <h2 className="text-sm font-semibold text-slate-200">Give someone a plan</h2>
        <p className="text-xs text-slate-500">For charity, student, lifetime or pay-what-you-can deals, or to keep someone’s Societies running while limits are switched on. No payment is taken.</p>
        <div className="grid gap-2 sm:grid-cols-4">
          <input value={g.handle} onChange={e => setG({ ...g, handle: e.target.value })} placeholder="Username" className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200" />
          <select value={g.plan} onChange={e => setG({ ...g, plan: e.target.value })} aria-label="Plan" className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200">
            {d.plans.filter(p => p.key !== 'free').map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
          </select>
          <input type="date" value={g.until} onChange={e => setG({ ...g, until: e.target.value })} aria-label="Until (optional)" className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200" />
          <input value={g.reason} onChange={e => setG({ ...g, reason: e.target.value })} placeholder="Reason" maxLength={300} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200" />
        </div>
        <button disabled={!g.handle.trim() || !g.reason.trim()}
          onClick={async () => { if (await call('POST', { ...g, until: g.until || null })) setG({ handle: '', plan: 'society_plus', until: '', reason: '' }); }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40">Give plan</button>
        {d.grants.length > 0 && (
          <ul className="divide-y divide-slate-800 text-xs text-slate-300">
            {d.grants.map(x => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>@{x.person}: {x.plan === 'society_plus' ? 'Network' : 'Team'}, {day(x.until)} · {x.reason}{x.granted_by ? ` · by @${x.granted_by}` : ''}</span>
                <button onClick={() => { if (confirm('End this plan now?')) void call('DELETE', undefined, `?id=${x.id}`); }} className="text-rose-400 hover:text-rose-300">End</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
