'use client';

import { useEffect, useState } from 'react';

type Data = {
  settings: { enabled: boolean; wallet: boolean; faceProvider: string; challenge16: number; challenge18: number };
  providers: { id: string; label: string; ready: boolean }[];
  trust: { dir: string; issuers: { subject: string; file: string; validTo: string }[] };
};

// Admin → Privacy: age checks (wallet proof, face check provider, challenge ages).
export default function AgeChecksCard() {
  const [d, setD] = useState<Data | null>(null);
  const [msg, setMsg] = useState('');
  const load = () => fetch('/api/admin/age-checks').then(r => r.ok ? r.json() : null).then(setD).catch(() => {});
  useEffect(() => { void load(); }, []);
  async function save(patch: Partial<Data['settings']>) {
    setMsg('');
    const r = await fetch('/api/admin/age-checks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    if (r.ok) { setMsg('Saved'); void load(); } else setMsg('Couldn’t save');
  }
  if (!d) return <div className="h-24 animate-pulse rounded-2xl bg-slate-800/40" />;
  const s = d.settings;
  const box = 'rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200';
  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-dr-card p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-100">Age checks</h3>
        <p className="mt-1 text-xs text-slate-400">
          Highly effective age assurance, used only when a trigger fires: joining a local Society, moving up to 18+, or age signals.
          Wallet proofs are checked on our own server; face checks use the provider chosen here.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-200">
        <input type="checkbox" checked={s.enabled} onChange={e => save({ enabled: e.target.checked })} className="accent-blue-500" />
        Age checks on (members are asked when a trigger fires)
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-200">
        <input type="checkbox" checked={s.wallet} onChange={e => save({ wallet: e.target.checked })} className="accent-blue-500" />
        Offer the wallet proof {d.trust.issuers.length ? '' : <span className="text-xs text-amber-300">(no trusted issuers yet: it won’t be offered)</span>}
      </label>
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
        Face check provider
        <select value={s.faceProvider} onChange={e => save({ faceProvider: e.target.value })} className={box}>
          {d.providers.map(p => <option key={p.id} value={p.id} disabled={!p.ready}>{p.label}{p.ready ? '' : ' (not configured)'}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
        Challenge ages: 16+ needs an estimate of at least
        <input type="number" min={16} max={30} defaultValue={s.challenge16} onBlur={e => save({ challenge16: Number(e.target.value) })} className={`${box} w-16`} />
        and 18+ at least
        <input type="number" min={18} max={35} defaultValue={s.challenge18} onBlur={e => save({ challenge18: Number(e.target.value) })} className={`${box} w-16`} />
      </div>
      <p className="text-[11px] text-slate-500">Agree the challenge ages with the provider, from its published accuracy for 16 and 17-year-olds, and record why in the risk assessment.</p>
      <div>
        <p className="text-xs font-semibold text-slate-300">Trusted wallet issuers ({d.trust.issuers.length})</p>
        <p className="text-[11px] text-slate-500">Root certificates (PEM) in <code className="text-slate-400">{d.trust.dir}</code> on the server. We trust the issuer, not the wallet app.</p>
        <ul className="mt-1 space-y-0.5 text-[11px] text-slate-400">
          {d.trust.issuers.map(t => <li key={t.subject + t.file}>{t.subject} <span className="text-slate-600">({t.file}, until {new Date(t.validTo).toLocaleDateString('en-GB')})</span></li>)}
        </ul>
      </div>
      {msg && <p className="text-xs text-emerald-300">{msg}</p>}
    </div>
  );
}
