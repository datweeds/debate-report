'use client';

import { useCallback, useEffect, useState } from 'react';

type Data = {
  newsReachable: boolean; mode: 'off' | 'on' | 'auto' | null; daily_budget_usd: number | null;
  spent_today_usd: number; news_spent_today_usd: number; site_spent_today_usd: number;
  available: boolean | null; reason: string | null;
  newsUsage: { day: string; model: string; task: string; tokens_in: number; tokens_out: number; cost_usd: number }[];
  siteUsage: { day: string; task: string; scope: string; calls: number; errors: number; skipped: number; cost_usd: number }[];
  societies: { id: number; name: string; mode: string; preset: string | null; model_standard: string | null; monthly_budget_usd: number | null;
    news_enabled: boolean | null; news_use_llm: boolean | null; platform_usd: number; own_usd: number; news_platform_usd: number; news_own_usd: number }[];
};

const usd = (n: number) => (n > 0 && n < 0.01 ? '<$0.01' : `$${n.toFixed(2)}`);
const MODES = [
  { id: 'off', label: 'Off', text: 'No AI anywhere on the platform’s account. Features use their non-AI versions. Societies with their own provider are unaffected.' },
  { id: 'auto', label: 'Auto', text: 'News uses AI only while someone has read a Society’s News in the last 7 days; other features as needed.' },
  { id: 'on', label: 'On', text: 'AI whenever features need it, within the daily cap.' },
] as const;

// SysAdmin: the site-wide AI switch and daily cap, today's spend, and every
// Society's AI choice and spend.
export default function AiTab() {
  const [d, setD] = useState<Data | null>(null);
  const [mode, setMode] = useState<string>('auto');
  const [cap, setCap] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [monthCap, setMonthCap] = useState('');
  const [month, setMonth] = useState<{ month: number; monthlyCap: number | null } | null>(null);
  const [monthMsg, setMonthMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const loadMonth = useCallback(async () => {
    const r = await fetch('/api/admin/ai/spend');
    if (!r.ok) return;
    const s = await r.json();
    setMonth(s); setMonthCap(s.monthlyCap != null ? String(s.monthlyCap) : '');
  }, []);
  useEffect(() => { void loadMonth(); }, [loadMonth]);
  async function saveMonth() {
    setMonthMsg(null);
    const r = await fetch('/api/admin/ai/spend', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ monthly_cap_usd: monthCap === '' ? null : Number(monthCap) }) });
    const res = await r.json().catch(() => ({}));
    setMonthMsg(r.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: res.error ?? 'Could not save.' });
    if (r.ok) await loadMonth();
  }

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/ai');
    if (!r.ok) return;
    const data: Data = await r.json();
    setD(data); setMode(data.mode ?? 'auto'); setCap(data.daily_budget_usd != null ? String(data.daily_budget_usd) : '');
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    setSaving(true); setMsg(null);
    const r = await fetch('/api/admin/ai', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, daily_budget_usd: Number(cap) }) });
    const res = await r.json().catch(() => ({}));
    setSaving(false);
    setMsg(r.ok ? { ok: true, text: 'Saved. Takes effect within a minute.' } : { ok: false, text: res.error ?? 'Could not save.' });
    if (r.ok) await load();
  }

  if (!d) return <div className="h-24 rounded-xl bg-slate-800/40 animate-pulse" />;
  const pct = d.daily_budget_usd ? Math.min(100, (d.spent_today_usd / d.daily_budget_usd) * 100) : 0;
  if (d.daily_budget_usd != null && d.spent_today_usd >= d.daily_budget_usd) {
    d.available = false;
    d.reason = 'Daily cap reached: platform AI is paused until midnight UTC';
  }
  const byDay = new Map<string, { news: number; site: number; own: number }>();
  for (const u of d.newsUsage) { const k = String(u.day).slice(0, 10); const v = byDay.get(k) ?? { news: 0, site: 0, own: 0 }; v.news += u.cost_usd; byDay.set(k, v); }
  for (const u of d.siteUsage) { const v = byDay.get(u.day) ?? { news: 0, site: 0, own: 0 }; if (u.scope === 'own') v.own += u.cost_usd; else v.site += u.cost_usd; byDay.set(u.day, v); }
  const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);
  const problems = d.siteUsage.reduce((n, u) => n + u.errors, 0);

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">
        The platform’s AI is used by News (tagging stories and writing editions) and the Debate Quality Report, for every Society that hasn’t chosen its own provider.
        The daily cap covers all of it. Societies using their own provider pay it directly; that spend is shown but never counts against the cap.
      </p>
      {!d.newsReachable && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">The News service isn’t reachable, so the switch and cap can’t be changed right now.</p>}

      <div className="rounded-2xl border border-slate-800 bg-dr-card p-5 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-200">Today</h2>
          <span className={`text-xs ${d.available ? 'text-emerald-400' : 'text-amber-300'}`}>{d.available ? '● AI available' : `● ${d.reason || 'AI not available'}`}</span>
        </div>
        <div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>{usd(d.spent_today_usd)} of {d.daily_budget_usd != null ? usd(d.daily_budget_usd) : '—'} (News {usd(d.news_spent_today_usd)} · Quality Reports {usd(d.site_spent_today_usd)})</span>
            <span>{pct.toFixed(0)}%</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-800"><div className={`h-2 rounded-full ${pct >= 80 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} /></div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map(m => (
            <button key={m.id} type="button" onClick={() => setMode(m.id)}
              className={`rounded-lg border px-3 py-2 text-left ${mode === m.id ? 'border-blue-500/60 bg-blue-500/10' : 'border-slate-700 bg-slate-900 hover:border-slate-500'}`}>
              <span className={`block text-sm font-semibold ${mode === m.id ? 'text-blue-200' : 'text-slate-300'}`}>{m.label}</span>
              <span className="block text-xs text-slate-500">{m.text}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Daily cap (US$, all platform AI)</label>
            <input type="number" min={0} step="0.5" value={cap} onChange={e => setCap(e.target.value)}
              className="w-36 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
          </div>
          <button onClick={save} disabled={saving || !d.newsReachable} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
          {msg && <span className={`text-xs ${msg.ok ? 'text-emerald-400' : 'text-rose-300'}`}>{msg.text}</span>}
        </div>
        <div className="flex flex-wrap items-end gap-3 border-t border-slate-800 pt-4">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Monthly cap (US$, all platform AI; empty = none)</label>
            <input type="number" min={0} step="1" value={monthCap} onChange={e => setMonthCap(e.target.value)}
              className="w-36 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
          </div>
          <button onClick={saveMonth} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">Save</button>
          {month && <span className="text-xs text-slate-400">This month so far: ${month.month.toFixed(2)}{month.monthlyCap != null ? ` of $${month.monthlyCap.toFixed(2)}` : ''}</span>}
          {monthMsg && <span className={`text-xs ${monthMsg.ok ? 'text-emerald-400' : 'text-rose-300'}`}>{monthMsg.text}</span>}
        </div>
        <p className="text-xs text-slate-500">You’re emailed when spend reaches 95% of the daily or monthly cap. The monthly cap pauses platform AI until the 1st.</p>
        <p className="text-xs text-slate-500">When the cap is reached, platform AI pauses until midnight UTC; features use their non-AI versions. Model choice and prices for the platform’s own AI are in the News service’s llm.yaml.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-dr-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Societies (last 30 days)</h2>
        <table className="w-full text-left text-xs">
          <thead className="text-slate-500"><tr>
            <th className="py-1 font-normal">Society</th><th className="font-normal">AI</th><th className="font-normal">News</th>
            <th className="text-right font-normal">Platform</th><th className="text-right font-normal">Own provider</th>
          </tr></thead>
          <tbody className="text-slate-300">
            {d.societies.map(s => (
              <tr key={s.id} className="border-t border-slate-800/60">
                <td className="py-1.5">{s.name}</td>
                <td>{s.mode === 'own' ? `Own: ${s.preset ?? '?'}${s.model_standard ? ` · ${s.model_standard}` : ''}${s.monthly_budget_usd != null ? ` · ${usd(s.monthly_budget_usd)}/mo` : ''}` : s.mode === 'off' ? 'Off' : 'Platform'}</td>
                <td className="text-slate-500">{s.news_enabled == null ? '—' : !s.news_enabled ? 'Off' : s.news_use_llm ? 'On, AI write-ups' : 'On, headlines only'}</td>
                <td className="text-right tabular-nums">{usd(s.platform_usd + s.news_platform_usd)}</td>
                <td className="text-right tabular-nums">{usd(s.own_usd + s.news_own_usd)}</td>
              </tr>
            ))}
            {d.societies.length === 0 && <tr><td colSpan={5} className="py-2 text-slate-500">No AI use yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-dr-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">By day {problems > 0 && <span className="ml-2 text-xs font-normal text-amber-300">{problems} failed calls in the last 30 days</span>}</h2>
        <table className="w-full text-left text-xs">
          <thead className="text-slate-500"><tr><th className="py-1 font-normal">Day</th><th className="text-right font-normal">News</th><th className="text-right font-normal">Quality Reports</th><th className="text-right font-normal">Societies’ own</th></tr></thead>
          <tbody className="text-slate-300">
            {days.map(([day, v]) => (
              <tr key={day} className="border-t border-slate-800/60">
                <td className="py-1">{day}</td><td className="text-right tabular-nums">{usd(v.news)}</td>
                <td className="text-right tabular-nums">{usd(v.site)}</td><td className="text-right tabular-nums">{usd(v.own)}</td>
              </tr>
            ))}
            {days.length === 0 && <tr><td colSpan={4} className="py-2 text-slate-500">No AI use yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
