'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Stats {
  totals: { users: number; debates: number; statements: number; votes: number };
  popularDebates: { id: string; stat_title: string; child_count: number; votes: number }[];
  staleDebates: { id: string; stat_title: string; idle_days: number }[];
  debatesByMonth: { month: string; count: number }[];
  scienceTotal: number;
  scienceByMonth: { month: string; count: number }[];
  aiArgTotal: number;
  aiArgByMonth: { month: string; count: number }[];
  server: { uptimeSeconds: number; memoryMB: number };
}

type AlertSource = 'auto' | 'manual';
type AlertStatusFilter = 'all' | 'pending' | 'masked' | 'passed';

interface AdminAlert {
  id: string;
  source: AlertSource;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  content_type: string | null;
  flagged_text: string | null;
  flags: string[] | null;
  reason: string | null;
  resolution_id: string | null;
  content_id: string | null;
  statement_title: string | null;
  resolution_title: string | null;
  author_handle: string | null;
  author_email: string | null;
  owner_handle: string | null;
  owner_email: string | null;
  flagger_handle: string | null;
  flagger_email: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtUptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function truncate(s: string, n = 120) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

const SCAN_FLAG_LABELS: Record<string, string> = {
  profanity:   'Profanity',
  hate_speech: 'Hate Speech',
  pii:         'Personal Data',
};

const MANUAL_REASON_LABELS: Record<string, string> = {
  inappropriate: 'Inappropriate',
  hate_speech:   'Hate Speech',
  personal_data: 'Personal Data',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  masked:  'bg-red-500/15 text-red-300 border-red-500/30',
  passed:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

// ── Mini chart ────────────────────────────────────────────────────────────────

function MiniLineChart({ data, color = '#3b82f6' }: { data: { month: string; count: number }[]; color?: string }) {
  if (!data.length) {
    return <p className="text-xs text-slate-600 text-center py-6">No data yet</p>;
  }
  const max = Math.max(...data.map(d => d.count), 1);
  const W = 480, H = 100, PAD = 16;
  const pts = data.map((d, i) => ({
    x: PAD + (i / Math.max(data.length - 1, 1)) * (W - PAD * 2),
    y: H - PAD - ((d.count / max) * (H - PAD * 2)),
    ...d,
  }));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${path} L ${pts[pts.length - 1].x} ${H - PAD} L ${pts[0].x} ${H - PAD} Z`;
  const gradId = `grad-${color.replace('#', '')}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(p => <circle key={p.month} cx={p.x} cy={p.y} r="3" fill={color} />)}
      {pts.map(p => (
        <text key={`l-${p.month}`} x={p.x} y={H} fontSize="8" fill="#475569" textAnchor="middle">
          {p.month}
        </text>
      ))}
    </svg>
  );
}

// ── Email compose modal ───────────────────────────────────────────────────────

interface EmailTarget { label: string; email: string; handle: string | null }

function EmailModal({ alert, onClose }: { alert: AdminAlert; onClose: () => void }) {
  const targets: EmailTarget[] = [];
  if (alert.owner_email)   targets.push({ label: 'Debate owner',    email: alert.owner_email,   handle: alert.owner_handle });
  if (alert.author_email)  targets.push({ label: 'Statement author', email: alert.author_email,  handle: alert.author_handle });
  if (alert.flagger_email) targets.push({ label: 'Flag reporter',   email: alert.flagger_email, handle: alert.flagger_handle });

  const [selected, setSelected] = useState<Set<string>>(new Set(targets.map(t => t.email)));
  const [subject, setSubject]   = useState(
    `debate.report — Content Alert on "${truncate(alert.resolution_title ?? alert.statement_title ?? 'your debate', 60)}"`
  );
  const [body, setBody] = useState(
    `Hello,\n\nA content alert has been raised on debate.report regarding content in the debate:\n"${alert.resolution_title ?? alert.statement_title ?? ''}"\n\n${
      alert.source === 'auto'
        ? `Our automated scanner flagged the following text:\n"${alert.flagged_text ?? ''}"\n\nFlags: ${(alert.flags ?? []).map(f => SCAN_FLAG_LABELS[f] ?? f).join(', ')}`
        : `A user reported this statement for: ${MANUAL_REASON_LABELS[alert.reason ?? ''] ?? alert.reason ?? ''}`
    }\n\nPlease review your content and ensure it complies with our community guidelines.\n\nKind regards,\ndebate.report`
  );

  const toggle = (email: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(email) ? next.delete(email) : next.add(email);
    return next;
  });

  const selectedList = targets.filter(t => selected.has(t.email));

  const openMailto = () => {
    if (!selectedList.length) return;
    const to  = selectedList.map(t => t.email).join(',');
    const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card-dr w-full max-w-xl p-6 relative flex flex-col gap-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-slate-300">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>

        <div>
          <h2 className="text-sm font-semibold text-slate-100">Compose email</h2>
          <p className="text-xs text-slate-500 mt-0.5">Select recipients — opens your email client with pre-filled content.</p>
        </div>

        {/* Recipients */}
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Recipients</p>
          {targets.length === 0 ? (
            <p className="text-xs text-slate-600">No email addresses available for this alert.</p>
          ) : (
            <div className="space-y-2">
              {targets.map(t => (
                <label key={t.email} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(t.email)}
                    onChange={() => toggle(t.email)}
                    className="rounded border-slate-600 bg-slate-800 text-blue-500"
                  />
                  <span className="text-sm text-slate-300">
                    {t.label}
                    {t.handle && <span className="text-slate-500 ml-1">@{t.handle}</span>}
                    <span className="text-slate-600 ml-2 font-mono text-xs">{t.email}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Subject */}
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Subject</p>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Body */}
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Message</p>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={10}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono resize-y"
          />
        </div>

        <button
          onClick={openMailto}
          disabled={selectedList.length === 0 || targets.length === 0}
          className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
        >
          Open in email client ({selectedList.length} recipient{selectedList.length !== 1 ? 's' : ''})
        </button>
      </div>
    </div>
  );
}

// ── Alert card ────────────────────────────────────────────────────────────────

function AlertCard({ alert, onEmail }: { alert: AdminAlert; onEmail: (a: AdminAlert) => void }) {
  const hasEmail = !!(alert.owner_email || alert.author_email || alert.flagger_email);
  const statusLabel = alert.status === 'pending' ? 'Under Review' : alert.status === 'masked' ? 'Masked' : 'Passed';

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0c1322] p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Source badge */}
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            alert.source === 'auto'
              ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
              : 'bg-orange-500/15 text-orange-300 border-orange-500/30'
          }`}>
            {alert.source === 'auto' ? 'Auto-scan' : 'Manual flag'}
          </span>

          {/* Status badge */}
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[alert.status] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
            {statusLabel}
          </span>

          {/* Flag tags */}
          {alert.source === 'auto' && alert.flags?.map(f => (
            <span key={f} className="rounded-full border bg-red-500/10 text-red-300 border-red-500/30 px-2 py-0.5 text-[10px] font-semibold">
              {SCAN_FLAG_LABELS[f] ?? f}
            </span>
          ))}
          {alert.source === 'manual' && alert.reason && (
            <span className="rounded-full border bg-amber-500/10 text-amber-300 border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold">
              {MANUAL_REASON_LABELS[alert.reason] ?? alert.reason}
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-600 whitespace-nowrap flex-shrink-0" title={fmtDate(alert.created_at)}>
          {timeAgo(alert.created_at)}
        </span>
      </div>

      {/* Flagged text (auto-scan) */}
      {alert.source === 'auto' && alert.flagged_text && (
        <blockquote className="rounded-lg border-l-2 border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-300 italic leading-relaxed">
          {truncate(alert.flagged_text)}
        </blockquote>
      )}

      {/* Statement title (manual flag) */}
      {alert.source === 'manual' && alert.statement_title && (
        <p className="text-sm text-slate-300 font-medium">{truncate(alert.statement_title)}</p>
      )}

      {/* Meta row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1 text-xs text-slate-500">
        <div>
          <span className="text-slate-600 uppercase tracking-wider text-[10px] font-semibold">Raised</span>
          <p className="text-slate-400 mt-0.5">{fmtDate(alert.created_at)}</p>
        </div>
        <div>
          <span className="text-slate-600 uppercase tracking-wider text-[10px] font-semibold">
            {alert.source === 'auto' ? 'Flagged content by' : 'Flagged by'}
          </span>
          <p className="text-slate-400 mt-0.5">
            {alert.source === 'auto'
              ? (alert.author_handle ? `@${alert.author_handle}` : 'Unknown')
              : (alert.flagger_handle ? `@${alert.flagger_handle}` : 'Anonymous')}
          </p>
        </div>
        <div>
          <span className="text-slate-600 uppercase tracking-wider text-[10px] font-semibold">Forum owner</span>
          <p className="text-slate-400 mt-0.5">{alert.owner_handle ? `@${alert.owner_handle}` : '—'}</p>
        </div>
      </div>

      {/* Debate link */}
      {alert.resolution_id && alert.resolution_title && (
        <div className="text-xs">
          <span className="text-slate-600">Debate: </span>
          <Link
            href={`/chamber?resolution=${alert.resolution_id}`}
            target="_blank"
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            {truncate(alert.resolution_title, 80)}
          </Link>
        </div>
      )}

      {/* Email button */}
      <div className="pt-1">
        <button
          onClick={() => onEmail(alert)}
          disabled={!hasEmail}
          title={hasEmail ? 'Compose email to involved parties' : 'No email addresses available'}
          className="rounded-lg border border-blue-700/40 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          </svg>
          Email parties
          {!hasEmail && <span className="text-slate-600 font-normal">(no emails on file)</span>}
        </button>
      </div>
    </div>
  );
}

// ── Analytics tab ─────────────────────────────────────────────────────────────

function AnalyticsTab({ stats, staleDays, setStaleDays }: {
  stats: Stats;
  staleDays: number;
  setStaleDays: (n: number) => void;
}) {
  const filteredStale = stats.staleDebates.filter(d => d.idle_days >= staleDays);

  return (
    <div className="space-y-6">
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

      {/* AI API metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card-dr p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">#ScienceReports</p>
              <p className="text-2xl font-bold text-emerald-400 mt-0.5">{stats.scienceTotal.toLocaleString()}</p>
            </div>
            <div className="rounded-full bg-emerald-500/10 p-2.5">
              <svg className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 1-6.23-.693L4.001 14.5m15.799.8 1.5 4.2m-4.8-4.2-.75-2.1M4.001 14.5l-1.5 4.2m4.5-4.5.75-2.1" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-slate-600 mb-2">Science analysis API calls — last 12 months</p>
          <MiniLineChart data={stats.scienceByMonth} color="#34d399" />
        </div>

        <div className="card-dr p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">#AI-Generated-Debates</p>
              <p className="text-2xl font-bold text-violet-400 mt-0.5">{stats.aiArgTotal.toLocaleString()}</p>
            </div>
            <div className="rounded-full bg-violet-500/10 p-2.5">
              <svg className="h-5 w-5 text-violet-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-slate-600 mb-2">AI argument generation calls — last 12 months</p>
          <MiniLineChart data={stats.aiArgByMonth} color="#a78bfa" />
        </div>
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
              min={1} max={365}
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
    </div>
  );
}

// ── Alerts tab ────────────────────────────────────────────────────────────────

const STATUS_FILTERS: { value: AlertStatusFilter; label: string }[] = [
  { value: 'all',     label: 'All' },
  { value: 'pending', label: 'Under Review' },
  { value: 'masked',  label: 'Masked' },
  { value: 'passed',  label: 'Passed' },
];

function AlertsTab() {
  const [alerts,       setAlerts]       = useState<AdminAlert[]>([]);
  const [total,        setTotal]        = useState(0);
  const [statusFilter, setStatusFilter] = useState<AlertStatusFilter>('all');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [composing,    setComposing]    = useState<AdminAlert | null>(null);

  const load = useCallback(async (status: AlertStatusFilter) => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/admin/alerts?status=${status}`);
      if (!res.ok) throw new Error('Failed');
      const d = await res.json();
      setAlerts(d.alerts ?? []);
      setTotal(d.total ?? 0);
    } catch {
      setError('Could not load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(statusFilter); }, [statusFilter, load]);

  const autoCount   = alerts.filter(a => a.source === 'auto').length;
  const manualCount = alerts.filter(a => a.source === 'manual').length;

  return (
    <div className="space-y-5">
      {composing && <EmailModal alert={composing} onClose={() => setComposing(null)} />}

      {/* Source summary */}
      <div className="flex flex-wrap gap-3">
        <div className="card-dr px-4 py-3 flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-violet-400" />
          <span className="text-sm text-slate-400">Auto-scan</span>
          <span className="text-sm font-bold text-slate-100">{autoCount}</span>
        </div>
        <div className="card-dr px-4 py-3 flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-orange-400" />
          <span className="text-sm text-slate-400">Manual flags</span>
          <span className="text-sm font-bold text-slate-100">{manualCount}</span>
        </div>
        <div className="card-dr px-4 py-3 flex items-center gap-2.5">
          <span className="text-sm text-slate-500">Total</span>
          <span className="text-sm font-bold text-slate-100">{total}</span>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === f.value
                ? 'bg-slate-700 text-slate-100'
                : 'bg-slate-800/50 text-slate-500 hover:bg-slate-800 hover:text-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {[0,1,2,3].map(i => <div key={i} className="h-36 rounded-xl bg-slate-800/40 animate-pulse" />)}
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-12 text-center">
          <svg className="h-10 w-10 mx-auto text-slate-700 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <p className="text-sm text-slate-400 font-medium">No alerts</p>
          <p className="text-xs text-slate-600 mt-1">No alerts match the current filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(a => (
            <AlertCard key={`${a.source}-${a.id}`} alert={a} onEmail={setComposing} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Blog tab ──────────────────────────────────────────────────────────────────

interface BlogInfo {
  subscriberCount: number;
  posts: Array<{ slug: string; title: string; date: string; excerpt: string; image?: string; sent: boolean }>;
  sends: Array<{ post_slug: string; sent_count: number; created_at: string }>;
}

function BlogTab() {
  const [info,      setInfo]      = useState<BlogInfo | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState<string | null>(null);
  const [result,    setResult]    = useState<{ slug: string; sent: number; failed: number; total: number } | null>(null);
  const [error,     setError]     = useState('');

  useEffect(() => {
    fetch('/api/admin/blog')
      .then(r => r.json())
      .then(setInfo)
      .catch(() => setError('Could not load blog data'))
      .finally(() => setLoading(false));
  }, []);

  async function send(slug: string) {
    if (!confirm(`Send this post to all ${info?.subscriberCount ?? 0} subscribers?`)) return;
    setSending(slug); setResult(null); setError('');
    try {
      const res = await fetch('/api/admin/blog', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ slug }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? 'Send failed'); return; }
      setResult({ slug, sent: d.sent, failed: d.failed, total: d.total });
      // Mark post as sent locally
      setInfo(prev => prev ? {
        ...prev,
        posts: prev.posts.map(p => p.slug === slug ? { ...p, sent: true } : p),
      } : prev);
    } catch {
      setError('Network error');
    } finally {
      setSending(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Subscriber count */}
      <div className="card-dr p-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Active subscribers</p>
          <p className="text-3xl font-extrabold text-blue-400 mt-1">{info?.subscriberCount ?? 0}</p>
        </div>
        <div className="rounded-full bg-blue-500/10 p-3">
          <svg className="h-6 w-6 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          </svg>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>
      )}

      {result && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Sent <strong>{result.sent}</strong> of <strong>{result.total}</strong> emails for &ldquo;{result.slug}&rdquo;
          {result.failed > 0 && <span className="text-amber-300 ml-2">({result.failed} failed)</span>}
        </div>
      )}

      {/* Posts list */}
      <div className="card-dr overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-200">Blog posts</h2>
          <p className="text-xs text-slate-500 mt-0.5">Send a post as a newsletter to all active subscribers</p>
        </div>

        {!info?.posts.length ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-slate-500">No posts yet — add markdown files to the <code className="text-blue-400">posts/</code> directory</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {info.posts.map(post => (
              <div key={post.slug} className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-slate-200 truncate">{post.title}</p>
                    {post.sent && (
                      <span className="rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
                        Sent
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{post.excerpt}</p>
                  <p className="text-xs text-slate-700 mt-1">{post.date}</p>
                </div>
                <button
                  onClick={() => send(post.slug)}
                  disabled={!!sending || post.sent}
                  title={post.sent ? 'Already sent' : `Send to ${info.subscriberCount} subscribers`}
                  className="flex-shrink-0 rounded-lg border border-blue-700/40 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {sending === post.slug ? 'Sending…' : post.sent ? 'Sent ✓' : 'Send newsletter'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Send history */}
      {info?.sends && info.sends.length > 0 && (
        <div className="card-dr overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-slate-200">Send history</h2>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500">
                <th className="text-left px-5 py-2.5 font-medium">Post</th>
                <th className="text-right px-5 py-2.5 font-medium">Sent to</th>
                <th className="text-right px-5 py-2.5 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {info.sends.map(s => (
                <tr key={s.post_slug} className="hover:bg-slate-800/20">
                  <td className="px-5 py-2.5 text-slate-300">{s.post_slug}</td>
                  <td className="px-5 py-2.5 text-right text-slate-400">{s.sent_count}</td>
                  <td className="px-5 py-2.5 text-right text-slate-600">
                    {new Date(s.created_at).toLocaleDateString('en-GB')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Customers tab ─────────────────────────────────────────────────────────────

interface CustomerRow {
  id: number; name: string; subdomain: string; status: string;
  hero_text: string | null; contact_email: string | null;
  platform_contact_email: string | null; created_at: string;
  proposal_count: number; debate_count: number; proposal_debate_count: number;
}

interface CustomerAdmin { user_id: string; handle: string; created_at: string; }

function CustomerAdminsPanel({ customerId }: { customerId: number }) {
  const [admins, setAdmins]   = useState<CustomerAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [handle, setHandle]   = useState('');
  const [adding, setAdding]   = useState(false);
  const [err, setErr]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/customers/${customerId}/admins`);
      setAdmins(await r.json());
    } finally { setLoading(false); }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!handle.trim()) return;
    setAdding(true); setErr('');
    try {
      const r = await fetch(`/api/admin/customers/${customerId}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: handle.trim() }),
      });
      if (!r.ok) { const d = await r.json(); setErr(d.error ?? 'Failed'); return; }
      setHandle(''); load();
    } finally { setAdding(false); }
  }

  async function remove(userId: string) {
    await fetch(`/api/admin/customers/${customerId}/admins/${userId}`, { method: 'DELETE' });
    load();
  }

  if (loading) return <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent ml-1" />;

  return (
    <div className="mt-4 pt-4 border-t border-slate-800">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Customer Admins</p>
      {err && <p className="text-xs text-red-400 mb-2">{err}</p>}
      {admins.length === 0 ? (
        <p className="text-xs text-slate-600 mb-2">No admins assigned.</p>
      ) : (
        <ul className="space-y-1 mb-3">
          {admins.map(a => (
            <li key={a.user_id} className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-mono">@{a.handle}</span>
              <button onClick={() => remove(a.user_id)} className="text-rose-500 hover:text-rose-400 transition-colors">Remove</button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          value={handle}
          onChange={e => setHandle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="@handle"
          className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={add}
          disabled={adding || !handle.trim()}
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
        >
          {adding ? '…' : 'Add'}
        </button>
      </div>
    </div>
  );
}

const STATUS_CHIP: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  paused: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  closed: 'bg-slate-700 text-slate-400 border-slate-600',
};

function CustomersTab() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState<CustomerRow | null>(null);
  const [saving, setSaving]       = useState(false);
  const [showNew, setShowNew]     = useState(false);
  const [newForm, setNewForm]     = useState({ name: '', subdomain: '', hero_text: '', contact_email: '', platform_contact_email: '' });
  const [newSaving, setNewSaving] = useState(false);
  const [err, setErr]             = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/customers');
      setCustomers(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveEdit() {
    if (!editing) return;
    setSaving(true); setErr('');
    try {
      const r = await fetch(`/api/admin/customers/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      });
      if (!r.ok) { const d = await r.json(); setErr(d.error ?? 'Save failed'); return; }
      setEditing(null);
      load();
    } finally { setSaving(false); }
  }

  async function createCustomer() {
    if (!newForm.name.trim() || !newForm.subdomain.trim()) { setErr('Name and subdomain are required'); return; }
    setNewSaving(true); setErr('');
    try {
      const r = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newForm),
      });
      if (!r.ok) { const d = await r.json(); setErr(d.error ?? 'Create failed'); return; }
      setShowNew(false);
      setNewForm({ name: '', subdomain: '', hero_text: '', contact_email: '', platform_contact_email: '' });
      load();
    } finally { setNewSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /></div>;

  return (
    <div className="space-y-5">
      {err && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{err}</p>}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{customers.length} customer{customers.length !== 1 ? 's' : ''}</p>
        <button onClick={() => { setShowNew(true); setErr(''); }} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors">
          + New Customer
        </button>
      </div>

      {/* New customer form */}
      {showNew && (
        <div className="card-dr p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100">New Customer</h3>
          {[
            { label: 'Name', key: 'name', placeholder: 'e.g. ScotParl' },
            { label: 'Subdomain', key: 'subdomain', placeholder: 'e.g. scotparl' },
            { label: 'Hero text', key: 'hero_text', placeholder: 'Short tagline shown on the site' },
            { label: 'Contact email', key: 'contact_email', placeholder: 'customer@example.com' },
            { label: 'Platform contact email', key: 'platform_contact_email', placeholder: 'admin@new.vote' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
              <input
                value={(newForm as Record<string, string>)[f.key]}
                onChange={e => setNewForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={createCustomer} disabled={newSaving} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition-colors">
              {newSaving ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setShowNew(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {customers.map(c => (
          <div key={c.id} className="card-dr p-5">
            {editing?.id === c.id ? (
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {(['active', 'paused', 'closed'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setEditing(e => e ? { ...e, status: s } : e)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-colors ${editing.status === s ? STATUS_CHIP[s] : 'border-slate-700 text-slate-500'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {[
                  { label: 'Name', key: 'name' },
                  { label: 'Hero text', key: 'hero_text' },
                  { label: 'Contact email', key: 'contact_email' },
                  { label: 'Platform contact email', key: 'platform_contact_email' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                    <input
                      value={(editing as unknown as Record<string, string>)[f.key] ?? ''}
                      onChange={e => setEditing(p => p ? { ...p, [f.key]: e.target.value } : p)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                ))}
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition-colors">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditing(null)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-slate-100">{c.name}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_CHIP[c.status] ?? STATUS_CHIP.closed}`}>{c.status}</span>
                    <span className="text-xs text-slate-500 font-mono">{c.subdomain}</span>
                  </div>
                  {c.hero_text && <p className="text-xs text-slate-400 mb-1">{c.hero_text}</p>}
                  <div className="flex flex-wrap gap-4 mt-1.5 text-xs text-slate-500">
                    <span>{c.proposal_count} proposals</span>
                    <span>{c.debate_count + c.proposal_debate_count} debates</span>
                    {c.contact_email && <span>Contact: {c.contact_email}</span>}
                  </div>
                </div>
                <button onClick={() => { setEditing(c); setErr(''); }} className="flex-shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors">
                  Edit
                </button>
              </div>
            )}
            <CustomerAdminsPanel customerId={c.id} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type AdminTab = 'alerts' | 'analytics' | 'blog' | 'customers';

export default function AdminPage() {
  const [tab,      setTab]      = useState<AdminTab>('alerts');
  const [stats,    setStats]    = useState<Stats | null>(null);
  const [statsErr, setStatsErr] = useState('');
  const [staleDays, setStaleDays] = useState(60);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => setStatsErr('Failed to load analytics'));
  }, []);

  return (
    <div className="min-h-screen bg-dr-base py-10 px-4 sm:px-6">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-100">System Admin</h1>
          <p className="text-sm text-slate-500 mt-0.5">Platform monitoring and moderation</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-8 border-b border-slate-800">
          {([
            { id: 'alerts',    label: 'Alerts' },
            { id: 'analytics', label: 'Analytics' },
            { id: 'blog',      label: 'Blog' },
            { id: 'customers', label: 'Customers' },
          ] as { id: AdminTab; label: string }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? 'border-blue-500 text-blue-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'alerts' && <AlertsTab />}

        {tab === 'analytics' && (
          statsErr ? (
            <p className="text-red-400 text-sm">{statsErr}</p>
          ) : !stats ? (
            <div className="flex justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
          ) : (
            <AnalyticsTab stats={stats} staleDays={staleDays} setStaleDays={setStaleDays} />
          )
        )}

        {tab === 'blog' && <BlogTab />}

        {tab === 'customers' && <CustomersTab />}

        <div className="text-center mt-10">
          <Link href="/" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
            ← Back to site
          </Link>
        </div>

      </div>
    </div>
  );
}
