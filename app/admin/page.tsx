'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Stats {
  totals: { users: number; debates: number; statements: number; votes: number };
  popularDebates: { id: string; stat_title: string; child_count: number; votes: number }[];
  staleDebates: { id: string; stat_title: string; idle_days: number }[];
  debatesByMonth: { month: string; count: number }[];
  server: { uptimeSeconds: number; memoryMB: number };
}

function MiniLineChart({ data }: { data: { month: string; count: number }[] }) {
  if (!data.length) {
    return <p className="text-xs text-slate-600 text-center py-8">No debate data yet</p>;
  }
  const max = Math.max(...data.map(d => d.count), 1);
  const W = 480, H = 120, PAD = 16;
  const pts = data.map((d, i) => ({
    x: PAD + (i / Math.max(data.length - 1, 1)) * (W - PAD * 2),
    y: H - PAD - ((d.count / max) * (H - PAD * 2)),
    ...d,
  }));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${path} L ${pts[pts.length - 1].x} ${H - PAD} L ${pts[0].x} ${H - PAD} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" preserveAspectRatio="none">
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#grad)" />
      <path d={path} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(p => (
        <circle key={p.month} cx={p.x} cy={p.y} r="3" fill="#3b82f6" />
      ))}
      {pts.map(p => (
        <text key={`l-${p.month}`} x={p.x} y={H} fontSize="8" fill="#475569" textAnchor="middle">
          {p.month}
        </text>
      ))}
    </svg>
  );
}

function fmtUptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [staleDays, setStaleDays] = useState(60);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => setError('Failed to load stats'));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-dr-base flex items-center justify-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-dr-base flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  const filteredStale = stats.staleDebates.filter(d => d.idle_days >= staleDays);

  return (
    <div className="min-h-screen bg-dr-base py-10 px-4 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-100">System Admin</h1>
          <p className="text-sm text-slate-500 mt-0.5">Platform overview</p>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Users',      value: stats.totals.users,      color: 'text-blue-400' },
            { label: 'Debates',    value: stats.totals.debates,    color: 'text-amber-400' },
            { label: 'Statements', value: stats.totals.statements, color: 'text-emerald-400' },
            { label: 'Votes',      value: stats.totals.votes,      color: 'text-blue-400' },
          ].map(k => (
            <div key={k.label} className="card-dr p-5 text-center">
              <p className={`text-3xl font-extrabold ${k.color}`}>{k.value.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Debates over time */}
        <div className="card-dr p-6">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Debates created — last 12 months</h2>
          <MiniLineChart data={stats.debatesByMonth} />
        </div>

        {/* Popular debates */}
        <div className="card-dr p-6">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Most active debates</h2>
          {stats.popularDebates.length === 0 ? (
            <p className="text-xs text-slate-600">No debates yet</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800">
                  <th className="text-left pb-2 font-medium">Debate</th>
                  <th className="text-right pb-2 font-medium">Statements</th>
                  <th className="text-right pb-2 font-medium">Votes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {stats.popularDebates.map(d => (
                  <tr key={d.id} className="hover:bg-white/2">
                    <td className="py-2 text-slate-300 pr-4">{d.stat_title}</td>
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-200">Stale debates</h2>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">No activity for</label>
              <input
                type="number"
                value={staleDays}
                onChange={e => setStaleDays(Number(e.target.value))}
                min={1}
                max={365}
                className="w-16 rounded border border-slate-700 bg-dr-surface px-2 py-1 text-xs text-slate-300 text-right"
              />
              <span className="text-xs text-slate-500">days</span>
            </div>
          </div>
          {filteredStale.length === 0 ? (
            <p className="text-xs text-slate-600">No stale debates</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800">
                  <th className="text-left pb-2 font-medium">Debate</th>
                  <th className="text-right pb-2 font-medium">Idle (days)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredStale.map(d => (
                  <tr key={d.id}>
                    <td className="py-2 text-slate-300">{d.stat_title}</td>
                    <td className="py-2 text-right text-amber-400">{d.idle_days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* System health */}
        <div className="card-dr p-6">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">System health</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <p className="text-slate-500">Database</p>
              <p className="text-emerald-400 font-medium mt-0.5">● Connected</p>
            </div>
            <div>
              <p className="text-slate-500">Server uptime</p>
              <p className="text-slate-300 font-medium mt-0.5">{fmtUptime(stats.server.uptimeSeconds)}</p>
            </div>
            <div>
              <p className="text-slate-500">Memory (RSS)</p>
              <p className="text-slate-300 font-medium mt-0.5">{stats.server.memoryMB} MB</p>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link href="/" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
            ← Back to site
          </Link>
        </div>

      </div>
    </div>
  );
}
