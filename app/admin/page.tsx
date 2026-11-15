'use client';

import { useEffect, useState, useCallback } from 'react';
import SocietyImageField from '@/components/societies/SocietyImageField';
import PrincipleForm, { CATEGORY_META, type PrincipleFields } from '@/components/principles/PrincipleForm';
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

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
  hero_image: string | null; description: string | null;
  platform_contact_email: string | null; created_at: string;
  proposal_count: number; debate_count: number;
  is_public: boolean; visibility: 'public' | 'apply' | 'invite'; is_default: boolean;
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
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Society Admins</p>
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

// Membership for a PRIVATE society — who sees it listed under "Private
// Societies" in the nav and can switch to it. Mirrors CustomerAdminsPanel.
function SocietyMembersPanel({ customerId }: { customerId: number }) {
  const [members, setMembers] = useState<CustomerAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [handle, setHandle]   = useState('');
  const [adding, setAdding]   = useState(false);
  const [err, setErr]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/customers/${customerId}/members`);
      setMembers(await r.json());
    } finally { setLoading(false); }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!handle.trim()) return;
    setAdding(true); setErr('');
    try {
      const r = await fetch(`/api/admin/customers/${customerId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: handle.trim() }),
      });
      if (!r.ok) { const d = await r.json(); setErr(d.error ?? 'Failed'); return; }
      setHandle(''); load();
    } finally { setAdding(false); }
  }

  async function remove(userId: string) {
    await fetch(`/api/admin/customers/${customerId}/members/${userId}`, { method: 'DELETE' });
    load();
  }

  if (loading) return <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent ml-1" />;

  return (
    <div className="mt-4 pt-4 border-t border-slate-800">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Private Society Members</p>
      {err && <p className="text-xs text-red-400 mb-2">{err}</p>}
      {members.length === 0 ? (
        <p className="text-xs text-slate-600 mb-2">No members yet — nobody but sysadmin can see this society.</p>
      ) : (
        <ul className="space-y-1 mb-3">
          {members.map(m => (
            <li key={m.user_id} className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-mono">@{m.handle}</span>
              <button onClick={() => remove(m.user_id)} className="text-rose-500 hover:text-rose-400 transition-colors">Remove</button>
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

// Society dashboard image — uploads/removes immediately (not on Save), since
// the file has to reach the server either way.
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
  const [savedId, setSavedId]     = useState<number | null>(null); // brief "Saved" confirmation
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
      const savedId = editing.id;
      setEditing(null);
      setSavedId(savedId);
      setTimeout(() => setSavedId(cur => (cur === savedId ? null : cur)), 3000);
      load();
    } finally { setSaving(false); }
  }

  async function setDefault(id: number) {
    setErr('');
    const r = await fetch(`/api/admin/customers/${id}/set-default`, { method: 'POST' });
    if (!r.ok) { const d = await r.json(); setErr(d.error ?? 'Failed'); return; }
    load();
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
        <p className="text-sm text-slate-400">{customers.length} societ{customers.length !== 1 ? 'ies' : 'y'}</p>
        <button onClick={() => { setShowNew(true); setErr(''); }} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors">
          + New Society
        </button>
      </div>

      {/* New society form */}
      {showNew && (
        <div className="card-dr p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100">New Society</h3>
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
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Description</label>
                  <textarea
                    value={editing.description ?? ''}
                    onChange={e => setEditing(p => p ? { ...p, description: e.target.value } : p)}
                    rows={6}
                    placeholder="Describe the society in more detail — shown on its dashboard under the image. Line breaks are kept."
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-y"
                  />
                </div>
                <SocietyImageField
                  endpoint={`/api/admin/customers/${editing.id}/image`}
                  value={editing.hero_image}
                  onChange={path => {
                    setEditing(p => p ? { ...p, hero_image: path } : p);
                    setCustomers(cs => cs.map(c => c.id === editing.id ? { ...c, hero_image: path } : c));
                  }}
                />
                <label className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
                  Visibility
                  <select
                    value={editing.visibility}
                    onChange={e => setEditing(p => p ? { ...p, visibility: e.target.value as 'public' | 'apply' | 'invite', is_public: e.target.value === 'public' } : p)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200"
                  >
                    <option value="public">Public — anyone can see and enter</option>
                    <option value="apply">Apply — listed to all; members only, anyone can ask to join</option>
                    <option value="invite">Invite — hidden; members join by invite link</option>
                  </select>
                  {editing.is_default && editing.visibility !== 'public' && (
                    <span className="text-amber-400"> (will stop being the default)</span>
                  )}
                </label>
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
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${c.is_public ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' : 'bg-violet-500/15 text-violet-300 border-violet-500/30'}`}>
                      {c.visibility === 'public' ? 'Public' : c.visibility === 'apply' ? 'Apply' : 'Invite'}
                    </span>
                    {c.is_default && (
                      <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-amber-500/15 text-amber-300 border-amber-500/30">Default</span>
                    )}
                    <span className="text-xs text-slate-500 font-mono">{c.subdomain}</span>
                  </div>
                  {c.hero_text && <p className="text-xs text-slate-400 mb-1">{c.hero_text}</p>}
                  <div className="flex flex-wrap gap-4 mt-1.5 text-xs text-slate-500">
                    <span>{c.proposal_count} proposals</span>
                    <span>{c.debate_count} debates</span>
                    {c.contact_email && <span>Contact: {c.contact_email}</span>}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {savedId === c.id && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400" role="status">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      Saved
                    </span>
                  )}
                  {c.is_public && !c.is_default && (
                    <button onClick={() => setDefault(c.id)} className="rounded-lg border border-amber-700/40 px-3 py-1.5 text-xs text-amber-400 hover:border-amber-500 transition-colors">
                      Set as default
                    </button>
                  )}
                  <button onClick={() => { setEditing(c); setErr(''); }} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors">
                    Edit
                  </button>
                </div>
              </div>
            )}
            <CustomerAdminsPanel customerId={c.id} />
            {!c.is_public && <SocietyMembersPanel customerId={c.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Access Keys tab ───────────────────────────────────────────────────────────
// SysAdmin-issued keys that let a named recipient view chosen debates
// read-only, without an account. The link is shown once, at creation.

interface AccessKeyRow {
  id: string; label: string; created_at: string; expires_at: string | null;
  revoked_at: string | null; first_used_at: string | null; last_used_at: string | null;
  use_count: number; created_by_handle: string | null;
  debates: { id: string; title: string }[];
}
interface KeyDebateOption { id: string; title: string; visibility: string; society: string | null }

function fmtDateTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}

function AccessKeysTab() {
  const [keys, setKeys]         = useState<AccessKeyRow[]>([]);
  const [debates, setDebates]   = useState<KeyDebateOption[]>([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [showNew, setShowNew]   = useState(false);
  const [label, setLabel]       = useState('');
  const [chosen, setChosen]     = useState<Set<string>>(new Set());
  const [expiry, setExpiry]     = useState('30'); // days; '' = never
  const [creating, setCreating] = useState(false);
  const [newLink, setNewLink]   = useState<{ label: string; url: string } | null>(null);
  const [copied, setCopied]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [k, d] = await Promise.all([
        fetch('/api/admin/access-keys').then(r => r.json()),
        fetch('/api/admin/access-keys/debates').then(r => r.json()),
      ]);
      setKeys(Array.isArray(k) ? k : []);
      setDebates(Array.isArray(d) ? d : []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create() {
    setErr(''); setCreating(true);
    try {
      const r = await fetch('/api/admin/access-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          resolutionIds: [...chosen],
          expiresInDays: expiry.trim() === '' ? null : Number(expiry),
        }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error ?? 'Could not create key'); return; }
      setNewLink({ label, url: window.location.origin + d.path });
      setCopied(false);
      setShowNew(false); setLabel(''); setChosen(new Set()); setExpiry('30');
      load();
    } finally { setCreating(false); }
  }

  async function revoke(id: string) {
    if (!window.confirm('Revoke this key? Anyone using it loses access immediately.')) return;
    await fetch(`/api/admin/access-keys/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'revoke' }),
    });
    load();
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this key and its record? This cannot be undone.')) return;
    await fetch(`/api/admin/access-keys/${id}`, { method: 'DELETE' });
    load();
  }

  async function copyLink() {
    if (!newLink) return;
    try { await navigator.clipboard.writeText(newLink.url); setCopied(true); } catch { /* select manually */ }
  }

  function status(k: AccessKeyRow): { text: string; cls: string } {
    if (k.revoked_at) return { text: 'Revoked', cls: 'bg-slate-700 text-slate-400 border-slate-600' };
    if (k.expires_at && new Date(k.expires_at) < new Date()) return { text: 'Expired', cls: 'bg-slate-700 text-slate-400 border-slate-600' };
    if (k.first_used_at) return { text: 'Active · used', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    return { text: 'Active · not yet used', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
  }

  if (loading) return <div className="flex justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /></div>;

  return (
    <div className="space-y-5">
      {err && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{err}</p>}

      {newLink && (
        <div className="card-dr p-5 border-emerald-500/40">
          <p className="text-sm font-semibold text-slate-100 mb-1">Key created for “{newLink.label}”</p>
          <p className="text-xs text-amber-400 mb-3">Copy this link now — it is shown only once and can&apos;t be retrieved later.</p>
          <div className="flex gap-2">
            <input readOnly value={newLink.url} onFocus={e => e.target.select()}
              className="flex-1 min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono text-slate-200" />
            <button onClick={copyLink} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors">
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
            <button onClick={() => setNewLink(null)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors">
              Done
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Read-only access to chosen debates without an account. Revoking a key cuts off access immediately.
        </p>
        <button onClick={() => { setShowNew(true); setErr(''); }} className="flex-shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors">
          + New Key
        </button>
      </div>

      {showNew && (
        <div className="card-dr p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100">New Access Key</h3>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Who is it for?</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Their name, e.g. Jane Smith — shown as “Welcome Jane Smith”"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Debates it unlocks</label>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-700 divide-y divide-slate-800">
              {debates.map(d => (
                <label key={d.id} className="flex items-start gap-2.5 px-3 py-2 text-sm text-slate-300 cursor-pointer hover:bg-slate-800/40">
                  <input type="checkbox" className="mt-0.5" checked={chosen.has(d.id)}
                    onChange={e => setChosen(prev => { const n = new Set(prev); if (e.target.checked) n.add(d.id); else n.delete(d.id); return n; })} />
                  <span className="flex-1">{d.title}</span>
                  <span className="text-[11px] text-slate-500 whitespace-nowrap">{d.society ?? '—'} · {d.visibility}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Expires after (days) — leave blank for no expiry</label>
            <input value={expiry} onChange={e => setExpiry(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric"
              className="w-28 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
          </div>
          <div className="flex gap-2">
            <button onClick={create} disabled={creating || !label.trim() || chosen.size === 0}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition-colors">
              {creating ? 'Creating…' : 'Create key'}
            </button>
            <button onClick={() => setShowNew(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {keys.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No access keys yet.</p>
      ) : (
        <div className="space-y-3">
          {keys.map(k => {
            const st = status(k);
            const live = !k.revoked_at && !(k.expires_at && new Date(k.expires_at) < new Date());
            return (
              <div key={k.id} className="card-dr p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-slate-100">{k.label}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${st.cls}`}>{st.text}</span>
                    </div>
                    <ul className="text-xs text-slate-400 mb-2 space-y-0.5">
                      {k.debates.map(d => <li key={d.id}>• {d.title}</li>)}
                    </ul>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>Created {fmtDateTime(k.created_at)}{k.created_by_handle ? ` by @${k.created_by_handle}` : ''}</span>
                      <span>Expires {k.expires_at ? fmtDateTime(k.expires_at) : 'never'}</span>
                      <span>First opened {fmtDateTime(k.first_used_at)}</span>
                      <span>Last active {fmtDateTime(k.last_used_at)}</span>
                      <span>Link opened {k.use_count}×</span>
                      {k.revoked_at && <span>Revoked {fmtDateTime(k.revoked_at)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    {live && (
                      <button onClick={() => revoke(k.id)} className="rounded-lg border border-rose-700/40 px-3 py-1.5 text-xs text-rose-400 hover:border-rose-500 transition-colors">
                        Revoke
                      </button>
                    )}
                    <button onClick={() => remove(k.id)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type AdminTab = 'analytics' | 'blog' | 'customers' | 'keys' | 'moderators' | 'library';

// ── Principles library ───────────────────────────────────────────────────────
// The general-purpose principles Moderators can copy into their Societies.
type LibraryPrinciple = PrincipleFields & { id: string };

function PrinciplesLibraryTab() {
  const [rows, setRows] = useState<LibraryPrinciple[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await fetch('/api/principle-library');
    setRows(r.ok ? (await r.json()).principles : []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function send(url: string, method: string, body?: unknown): Promise<string | null> {
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) return (await r.json().catch(() => ({}))).error ?? 'Something went wrong';
    load();
    return null;
  }

  if (rows === null) return <div className="h-24 rounded-xl bg-slate-800/40 animate-pulse" />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">A starting set Moderators can copy into their Societies. Societies keep their own copies, so changes here don&apos;t alter principles already copied.</p>
        <button onClick={() => setAdding(true)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500">+ Add principle</button>
      </div>
      {adding && <PrincipleForm saveLabel="Add to library" onCancel={() => setAdding(false)}
        onSave={async v => { const err = await send('/api/admin/principle-library', 'POST', v); if (!err) setAdding(false); return err; }} />}
      <ol className="space-y-2">
        {rows.map((p, i) => (
          <li key={p.id} className="rounded-xl border border-slate-800 bg-[#0c1322] p-4">
            {editing === p.id ? (
              <PrincipleForm initial={p} onCancel={() => setEditing(null)}
                onSave={async v => { const err = await send(`/api/admin/principle-library/${p.id}`, 'PATCH', v); if (!err) setEditing(null); return err; }} />
            ) : (
              <div className="flex items-start gap-3">
                <span className="w-6 text-right text-sm font-bold text-slate-500">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <span className={`mr-2 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${CATEGORY_META[p.category].cls}`}>{CATEGORY_META[p.category].label}</span>
                  <span className="text-sm font-semibold text-slate-100">{p.title}</span>
                  <p className="mt-1 text-sm text-slate-300">{p.body}</p>
                  {p.grounding && <p className="mt-1 text-xs text-slate-500">Why: {p.grounding}</p>}
                </div>
                <div className="flex flex-col items-end gap-1 text-xs">
                  <button onClick={() => setEditing(p.id)} className="text-slate-400 hover:text-slate-200">Edit</button>
                  <button onClick={() => { if (confirm(`Delete "${p.title}" from the library?`)) send(`/api/admin/principle-library/${p.id}`, 'DELETE'); }} className="text-rose-400 hover:text-rose-300">Delete</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Moderator requests ───────────────────────────────────────────────────────
// Moderator is the paid role; until billing launches, users request it here.
type ModRequest = {
  id: string; status: 'pending' | 'approved' | 'rejected'; message: string | null;
  created_at: string; decided_at: string | null;
  user_handle: string; user_full_name: string | null; user_tier: string;
};

function ModeratorRequestsTab() {
  const [rows, setRows] = useState<ModRequest[] | null>(null);
  const load = useCallback(async () => {
    const r = await fetch('/api/admin/moderator-requests');
    setRows(r.ok ? (await r.json()).requests : []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function decide(id: string, action: 'approve' | 'reject') {
    await fetch('/api/admin/moderator-requests', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }),
    });
    load();
  }

  if (rows === null) return <div className="h-24 rounded-xl bg-slate-800/40 animate-pulse" />;
  const pending = rows.filter(r => r.status === 'pending');
  const decided = rows.filter(r => r.status !== 'pending');
  const when = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">People asking to become Moderators. Approving gives them Moderator tools at once (billing isn&apos;t live yet).</p>
      {pending.length === 0 ? (
        <p className="rounded-xl border border-slate-800 bg-[#0c1322] p-6 text-center text-sm text-slate-500">No pending requests.</p>
      ) : (
        <ul className="space-y-3">
          {pending.map(r => (
            <li key={r.id} className="rounded-xl border border-slate-800 bg-[#0c1322] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-slate-200">{r.user_full_name || `@${r.user_handle}`} <span className="text-xs text-slate-500">· @{r.user_handle} · {r.user_tier} · asked {when(r.created_at)}</span></p>
                  {r.message && <p className="mt-1 text-xs text-slate-400 whitespace-pre-line">{r.message}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => decide(r.id, 'approve')} className="rounded-lg bg-emerald-600/80 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500">Approve</button>
                  <button onClick={() => decide(r.id, 'reject')} className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-400 hover:text-slate-200">Decline</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {decided.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-2">Recent decisions</p>
          <ul className="space-y-1 text-xs text-slate-500">
            {decided.map(r => (
              <li key={r.id}>@{r.user_handle}: {r.status === 'approved' ? 'approved' : 'declined'} {r.decided_at ? when(r.decided_at) : ''}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [tab,      setTab]      = useState<AdminTab>('analytics');
  const [stats,    setStats]    = useState<Stats | null>(null);
  const [statsErr, setStatsErr] = useState('');
  const [staleDays, setStaleDays] = useState(60);

  // ?tab=customers (e.g. "Edit society" on a society dashboard) opens that tab.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'analytics' || t === 'blog' || t === 'customers' || t === 'keys' || t === 'moderators' || t === 'library') setTab(t);
  }, []);

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
            { id: 'analytics', label: 'Analytics' },
            { id: 'blog',      label: 'Blog' },
            { id: 'customers', label: 'Societies' },
            { id: 'keys',      label: 'Access Keys' },
            { id: 'moderators', label: 'Moderators' },
            { id: 'library',    label: 'Principles library' },
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
        {tab === 'keys'      && <AccessKeysTab />}
        {tab === 'moderators' && <ModeratorRequestsTab />}
        {tab === 'library'    && <PrinciplesLibraryTab />}

        <div className="text-center mt-10">
          <Link href="/" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
            ← Back to site
          </Link>
        </div>

      </div>
    </div>
  );
}
