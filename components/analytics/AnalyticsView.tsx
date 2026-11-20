'use client';

import { useState } from 'react';

// Analytics: metric tiles with 12-month charts, AI cost, the most active
// Societies and debates. Shared by Admin (whole site) and Society Admin
// (their own Societies only). Data from lib/analytics.ts.

type Series = { label: string; color: string; data: { month: string; count: number }[] };
type AiRow = { source: string; calls: number | null; tokensIn: number; tokensOut: number; usd: number; monthUsd: number; note?: string };
type Metric = {
  key: string; label: string; total: number; parts: { label: string; color: string; value: number }[]; series: Series[]; error?: boolean;
  unit?: 'usd'; ai?: { gbpRate: number; monthUsd: number; rows: AiRow[]; notes: string[] };
};
type ActiveSociety = { id: number; name: string; private: boolean; named: boolean; closed: boolean; href: string | null; emails: string[]; total: number; byArea: Record<string, number> };
export interface Stats {
  metrics: Metric[];
  activeSocieties: { areas: { label: string; color: string }[]; contact: boolean; windows: Record<string, ActiveSociety[]> } | null;
  popularDebates: { id: string; stat_title: string; child_count: number; votes: number }[];
  staleDebates: { id: string; stat_title: string; idle_days: number }[];
  server?: { uptimeSeconds: number; memoryMB: number; backup?: { ok: boolean; at: string; message: string; bytes: number; warnings: string[] } | null };
}

function fmtUptime(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}
const usd = (n: number) => `$${n < 10 ? n.toFixed(2) : Math.round(n).toLocaleString()}`;
const gbp = (n: number, rate: number) => `£${n * rate < 10 ? (n * rate).toFixed(2) : Math.round(n * rate).toLocaleString()}`;
const big = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n);

// ── Chart: one line per part, last 12 months ─────────────────────────────────
function MetricChart({ series, money }: { series: Series[]; money?: boolean }) {
  const months = series[0]?.data.map(d => d.month) ?? [];
  if (!months.length) return <p className="py-6 text-center text-xs text-slate-600">No data yet</p>;
  const max = Math.max(money ? 0.01 : 1, ...series.flatMap(s => s.data.map(d => d.count)));
  const W = 640, H = 180, L = 40, R = 12, T = 12, B = 22;
  const x = (i: number) => L + (i / Math.max(months.length - 1, 1)) * (W - L - R);
  const y = (n: number) => H - B - (n / max) * (H - T - B);
  const label = (n: number) => money ? usd(n) : String(Math.round(n));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full" role="img" aria-label="Last 12 months">
      {[0, 0.5, 1].map(f => (
        <g key={f}>
          <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke="#334155" strokeOpacity="0.5" strokeDasharray={f ? '3 4' : undefined} />
          <text x={L - 6} y={y(max * f) + 3} fontSize="9" fill="#64748b" textAnchor="end">{label(max * f)}</text>
        </g>
      ))}
      {months.map((m, i) => <text key={m} x={x(i)} y={H - 6} fontSize="9" fill="#64748b" textAnchor="middle">{m}</text>)}
      {series.map(s => {
        const path = s.data.map((d, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(d.count)}`).join(' ');
        return (
          <g key={s.label}>
            <path d={path} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {s.data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.count)} r="2.5" fill={s.color}><title>{`${s.label}, ${d.month}: ${label(d.count)}`}</title></circle>)}
          </g>
        );
      })}
    </svg>
  );
}

// ── AI usage: cost by source ─────────────────────────────────────────────────
function AiDetail({ ai }: { ai: NonNullable<Metric['ai']> }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[34rem] text-xs">
        <thead>
          <tr className="border-b border-slate-800 text-slate-500">
            <th className="pb-2 text-left font-medium">Source</th>
            <th className="pb-2 text-right font-medium">Calls</th>
            <th className="pb-2 text-right font-medium">Tokens in / out</th>
            <th className="pb-2 text-right font-medium">Cost</th>
            <th className="pb-2 text-right font-medium">This month</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {ai.rows.map(r => (
            <tr key={r.source} className={r.source.includes('own') ? 'text-slate-500' : 'text-slate-300'}>
              <td className="py-2 pr-3">{r.source}{r.note && <span className="block text-[10px] text-slate-500">{r.note}</span>}</td>
              <td className="py-2 text-right tabular-nums">{r.calls == null ? '–' : r.calls.toLocaleString()}</td>
              <td className="py-2 text-right tabular-nums">{big(r.tokensIn)} / {big(r.tokensOut)}</td>
              <td className="py-2 text-right tabular-nums">{usd(r.usd)} <span className="text-slate-500">{gbp(r.usd, ai.gbpRate)}</span></td>
              <td className="py-2 text-right tabular-nums">{usd(r.monthUsd)} <span className="text-slate-500">{gbp(r.monthUsd, ai.gbpRate)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-2 space-y-0.5 text-[11px] text-slate-500">{ai.notes.map(n => <li key={n}>{n}</li>)}</ul>
    </div>
  );
}

// ── Most active Societies: top 10, stacked by area ───────────────────────────
const WINDOWS = [{ key: 'd30', label: '30 days' }, { key: 'd90', label: '90 days' }, { key: 'd365', label: '12 months' }];
function ActiveSocieties({ data }: { data: NonNullable<Stats['activeSocieties']> }) {
  const [win, setWin] = useState('d30');
  const list = data.windows[win] ?? [];
  const max = Math.max(1, ...list.map(s => s.total));
  return (
    <div className="mt-6 border-t border-slate-800 pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-200">Most active Societies</h3>
        <div className="flex gap-1 text-xs" role="group" aria-label="Period">
          {WINDOWS.map(w => (
            <button key={w.key} onClick={() => setWin(w.key)} aria-pressed={win === w.key}
              className={`rounded-md px-2 py-1 ${win === w.key ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>{w.label}</button>
          ))}
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-slate-400">
        {data.areas.map(a => <span key={a.label} className="flex items-center gap-1.5"><span className="inline-block h-2 w-3 rounded-sm" style={{ background: a.color }} />{a.label}</span>)}
      </div>
      {!list.length ? <p className="py-4 text-center text-xs text-slate-600">No activity in this period</p> : (
        <ol className="space-y-2">
          {list.map((s, i) => (
            <li key={s.id} className="grid grid-cols-[1.5rem_minmax(0,11rem)_minmax(0,1fr)_auto] items-center gap-2 text-xs sm:grid-cols-[1.5rem_minmax(0,16rem)_minmax(0,1fr)_auto]">
              <span className="text-right tabular-nums text-slate-500">{i + 1}</span>
              <span className="truncate text-slate-300" title={s.name}>
                {s.private && <span aria-label="Private" title="Private Society">🔒 </span>}
                {s.href ? <a href={s.href} className="hover:text-blue-300 hover:underline">{s.name}</a> : <span className="italic text-slate-400">{s.name}</span>}
                {s.closed && <span className="ml-1 rounded border border-amber-500/40 px-1 text-[10px] text-amber-300">Closed</span>}
              </span>
              <span className="flex h-3.5 overflow-hidden rounded bg-slate-800/60" title={data.areas.filter(a => s.byArea[a.label]).map(a => `${a.label}: ${s.byArea[a.label]}`).join(' · ')}>
                {data.areas.map(a => s.byArea[a.label] ? <span key={a.label} style={{ width: `${(s.byArea[a.label] / max) * 100}%`, background: a.color }} /> : null)}
              </span>
              <span className="flex items-center gap-2 whitespace-nowrap">
                <span className="w-10 text-right tabular-nums text-slate-300">{s.total.toLocaleString()}</span>
                {data.contact && (s.emails.length ? (
                  <a href={`mailto:${s.emails.join(',')}?subject=${encodeURIComponent(`new.vote: ${s.named ? s.name : 'your Society'}`)}`}
                    title={`Email: ${s.emails.join(', ')}`} className="text-blue-400 hover:text-blue-300">✉ Admins</a>
                ) : <span className="text-slate-600" title="No moderator email on record">no email</span>)}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-[11px] text-slate-500">
        Activity: new discussions and messages, debate statements, votes and chat, events and responses, documents, polls and votes, project tasks, status reports and personal tasks.
        {data.contact && ' Private Societies you’re not a member of are shown by number only.'}
      </p>
    </div>
  );
}

// Last nightly backup: red when it failed or is more than 36 hours old
function BackupStatus({ b }: { b: NonNullable<Stats['server']>['backup'] | null }) {
  if (!b) return <div><p className="text-slate-500">Last backup</p><p className="mt-0.5 font-medium text-rose-400">● None recorded</p></div>;
  const stale = Date.now() - new Date(b.at).getTime() > 36 * 3600e3;
  const good = b.ok && !stale;
  return (
    <div className="col-span-2 sm:col-span-3">
      <p className="text-slate-500">Last backup</p>
      <p className={`mt-0.5 font-medium ${good ? (b.warnings.length ? 'text-amber-300' : 'text-emerald-400') : 'text-rose-400'}`}>
        ● {new Date(b.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} · {b.ok ? `${Math.round(b.bytes / 1048576)} MB, ${b.message}` : `FAILED: ${b.message}`}{stale ? ' · overdue' : ''}
      </p>
      {b.warnings.map(w => <p key={w} className="text-[11px] text-amber-300/80">{w}</p>)}
    </div>
  );
}

// ── The page ─────────────────────────────────────────────────────────────────
export default function AnalyticsView({ stats }: { stats: Stats }) {
  const [staleDays, setStaleDays] = useState(60);
  const [open, setOpen] = useState<string | null>(null);   // the metric whose chart is shown
  const filteredStale = stats.staleDebates.filter(d => d.idle_days >= staleDays);
  const shown = stats.metrics.find(m => m.key === open);
  const value = (m: Metric, n: number) => m.unit === 'usd' ? usd(n) : n.toLocaleString();

  return (
    <div className="space-y-6">
      {/* Metric tiles: click one for its chart */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.metrics.map(m => {
          const active = open === m.key;
          return (
            <button key={m.key} onClick={() => setOpen(active ? null : m.key)} aria-expanded={active}
              title={active ? 'Hide chart' : 'Show chart'}
              className={`card-dr p-4 text-left transition-colors ${active ? 'ring-1 ring-blue-500/60 bg-blue-500/5' : 'hover:bg-blue-500/5'}`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{m.label}</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-100">
                {m.error ? '–' : value(m, m.total)}
                {m.ai && !m.error && <span className="ml-1.5 text-sm font-semibold text-slate-400">{gbp(m.total, m.ai.gbpRate)}</span>}
              </p>
              {m.ai && !m.error && <p className="text-[11px] text-slate-500">est. · this month {usd(m.ai.monthUsd)}</p>}
              {m.parts.length > 1 && (
                <p className="mt-1 space-x-2 text-[11px] text-slate-400">
                  {m.parts.map(p => (
                    <span key={p.label} className="whitespace-nowrap">
                      <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: p.color }} />
                      {p.label} {value(m, p.value)}
                    </span>
                  ))}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {shown && (
        <div className="card-dr p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-200">{shown.label}: {shown.unit === 'usd' ? 'estimated cost each month' : 'new each month'}, last 12 months</h2>
            <div className="flex flex-wrap gap-3 text-xs text-slate-400">
              {shown.series.map(s => (
                <span key={s.label} className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-3 rounded-sm" style={{ background: s.color }} />{s.label}
                </span>
              ))}
              <button onClick={() => setOpen(null)} className="text-slate-500 hover:text-slate-300">Close</button>
            </div>
          </div>
          <MetricChart series={shown.series} money={shown.unit === 'usd'} />
          {shown.ai && <AiDetail ai={shown.ai} />}
          {shown.key === 'societies' && stats.activeSocieties && <ActiveSocieties data={stats.activeSocieties} />}
        </div>
      )}

      {/* Popular debates */}
      <div className="card-dr p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-200">Most active debates</h2>
        {stats.popularDebates.length === 0 ? <p className="text-xs text-slate-600">No debates yet</p> : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500">
                <th className="pb-2 text-left font-medium">Debate</th>
                <th className="pb-2 text-right font-medium">Statements</th>
                <th className="pb-2 text-right font-medium">Votes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {stats.popularDebates.map(d => (
                <tr key={d.id}>
                  <td className="py-2 pr-4 text-slate-300">{d.stat_title}</td>
                  <td className="py-2 text-right text-slate-400">{d.child_count}</td>
                  <td className="py-2 text-right text-slate-400">{d.votes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Stale debates */}
      <div className="card-dr p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Stale debates</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500" htmlFor="stale-days">No activity for</label>
            <input id="stale-days" type="number" value={staleDays} onChange={e => setStaleDays(Number(e.target.value))} min={1} max={365}
              className="w-16 rounded border border-slate-700 bg-dr-surface px-2 py-1 text-right text-xs text-slate-300" />
            <span className="text-xs text-slate-500">days</span>
          </div>
        </div>
        {filteredStale.length === 0 ? <p className="text-xs text-slate-600">No stale debates</p> : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500">
                <th className="pb-2 text-left font-medium">Debate</th>
                <th className="pb-2 text-right font-medium">Idle (days)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredStale.map(d => (
                <tr key={d.id}><td className="py-2 text-slate-300">{d.stat_title}</td><td className="py-2 text-right text-amber-400">{d.idle_days}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* System health (Sys Admin only) */}
      {stats.server && (
        <div className="card-dr p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-200">System health</h2>
          <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-3">
            <div><p className="text-slate-500">Database</p><p className="mt-0.5 font-medium text-emerald-400">● Connected</p></div>
            <div><p className="text-slate-500">Server uptime</p><p className="mt-0.5 font-medium text-slate-300">{fmtUptime(stats.server.uptimeSeconds)}</p></div>
            <div><p className="text-slate-500">Memory (RSS)</p><p className="mt-0.5 font-medium text-slate-300">{stats.server.memoryMB} MB</p></div>
            <BackupStatus b={stats.server.backup ?? null} />
          </div>
        </div>
      )}
    </div>
  );
}
