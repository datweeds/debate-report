'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

type MyAlert = {
  id: string;
  content_type: 'statement_title' | 'statement_description' | 'comment';
  content_id: string | null;
  resolution_id: string | null;
  flagged_text: string;
  flags: string[];
  status: 'pending' | 'passed' | 'masked';
  created_at: string;
  reviewed_at: string | null;
  appeal_body: string | null;
  appeal_at: string | null;
  appeal_status: 'none' | 'sent' | 'closed' | 'unmasked';
  statement_title: string | null;
  resolution_title: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const FLAG_COLOURS: Record<string, string> = {
  profanity:   'bg-orange-500/20 text-orange-300 border-orange-500/40',
  hate_speech: 'bg-red-600/20 text-red-300 border-red-500/40',
  pii:         'bg-violet-500/20 text-violet-300 border-violet-500/40',
};

const FLAG_LABELS: Record<string, string> = {
  profanity:   'Profanity',
  hate_speech: 'Hate Speech',
  pii:         'Personal Data',
};

const CONTENT_LABELS: Record<string, string> = {
  statement_title:       'Statement Title',
  statement_description: 'Description',
  comment:               'Comment',
};

function timeAgo(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function truncate(s: string, n = 140) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MyAlert['status'] }) {
  if (status === 'pending') return (
    <span className="rounded-full border border-amber-600/40 bg-amber-600/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
      Pending review
    </span>
  );
  if (status === 'passed') return (
    <span className="rounded-full border border-emerald-600/40 bg-emerald-600/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
      Passed
    </span>
  );
  return (
    <span className="rounded-full border border-red-600/40 bg-red-600/15 px-2 py-0.5 text-[10px] font-semibold text-red-300">
      Masked
    </span>
  );
}

// ── Appeal section within a card ──────────────────────────────────────────────

function AppealSection({ alert, onAppealed }: { alert: MyAlert; onAppealed: (id: string) => void }) {
  const [body,    setBody]    = useState('');
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');

  async function submit() {
    if (!body.trim()) return;
    setSaving(true); setErr('');
    try {
      const res = await fetch(`/api/alerts/${alert.id}/appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim() }),
      });
      if (!res.ok) { const d = await res.json(); setErr(d.error ?? 'Failed'); return; }
      onAppealed(alert.id);
    } catch {
      setErr('Could not submit appeal');
    } finally {
      setSaving(false);
    }
  }

  if (alert.appeal_status === 'unmasked') return (
    <div className="rounded-lg border border-emerald-700/40 bg-emerald-900/10 px-3 py-2.5 text-sm text-emerald-300">
      Appeal successful — your content has been restored by a moderator.
    </div>
  );

  if (alert.appeal_status === 'closed') return (
    <div className="space-y-2">
      <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2.5 text-sm text-slate-400">
        Your appeal was reviewed and the mask was upheld.
      </div>
      <p className="text-xs text-slate-500">
        If you believe this decision was made in error, you can escalate to the platform admin team via{' '}
        <Link href="/contact" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
          Contact Us
        </Link>
        .
      </p>
    </div>
  );

  if (alert.appeal_status === 'sent') return (
    <div className="space-y-2">
      <div className="rounded-lg border border-amber-700/40 bg-amber-900/10 px-3 py-2.5 text-sm text-amber-300">
        Appeal submitted {timeAgo(alert.appeal_at!)} — awaiting moderator review.
      </div>
      <p className="text-xs text-slate-500">
        If you need to escalate, contact the platform admin team via{' '}
        <Link href="/contact" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
          Contact Us
        </Link>
        .
      </p>
    </div>
  );

  // appeal_status === 'none' — show appeal form
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">
        Your content was masked by automated scanning. If you believe this was an error, you can send a one-time appeal to the moderator.
      </p>
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Explain why you believe the mask should be removed…"
        maxLength={1000}
        rows={3}
        className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-blue-500/50 focus:outline-none resize-none"
      />
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={saving || !body.trim()}
          className="rounded-lg border border-blue-600/50 bg-blue-600/20 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-600/30 disabled:opacity-40 transition-colors"
        >
          {saving ? 'Submitting…' : 'Submit Appeal'}
        </button>
        <p className="text-xs text-slate-600">{body.length}/1000</p>
      </div>
      <p className="text-xs text-slate-600">
        Only one appeal is allowed. If the appeal is closed, you may escalate to the platform admin team via{' '}
        <Link href="/contact" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
          Contact Us
        </Link>
        .
      </p>
    </div>
  );
}

// ── My alert card ─────────────────────────────────────────────────────────────

function MyAlertCard({ alert, onAppealed }: { alert: MyAlert; onAppealed: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0c1322] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border bg-slate-700/50 text-slate-400 border-slate-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            {CONTENT_LABELS[alert.content_type] ?? alert.content_type}
          </span>
          {alert.flags.map(f => (
            <span key={f} className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${FLAG_COLOURS[f] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
              {FLAG_LABELS[f] ?? f}
            </span>
          ))}
          <StatusBadge status={alert.status} />
        </div>
        <span className="text-[11px] text-slate-600 whitespace-nowrap flex-shrink-0">{timeAgo(alert.created_at)}</span>
      </div>

      <blockquote className="rounded-lg border-l-2 border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-300 leading-relaxed italic">
        {truncate(alert.flagged_text)}
      </blockquote>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {alert.resolution_title && (
          <span>
            Debate:{' '}
            <a href={`/chamber?resolution=${alert.resolution_id}`} target="_blank"
              className="text-blue-400 hover:text-blue-300 transition-colors">
              {truncate(alert.resolution_title, 60)}
            </a>
          </span>
        )}
        {alert.statement_title && alert.content_type !== 'statement_title' && (
          <span>Statement: <span className="text-slate-400">{truncate(alert.statement_title, 60)}</span></span>
        )}
        {alert.reviewed_at && (
          <span>Reviewed {timeAgo(alert.reviewed_at)}</span>
        )}
      </div>

      {alert.status === 'masked' && (
        <div>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {expanded ? 'Hide appeal ▴' : 'Appeal this decision ▾'}
          </button>
          {expanded && (
            <div className="mt-3">
              <AppealSection alert={alert} onAppealed={onAppealed} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type FilterStatus = 'pending' | 'masked' | 'passed';

type Counts = { pending: number; masked: number; passed: number };

export default function AlertsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');
  const [alerts,       setAlerts]       = useState<MyAlert[]>([]);
  const [total,        setTotal]        = useState(0);
  const [fetching,     setFetching]     = useState(false);
  const [error,        setError]        = useState('');
  const [counts,       setCounts]       = useState<Counts>({ pending: 0, masked: 0, passed: 0 });

  useEffect(() => {
    if (!loading && !user) router.push('/login?next=/dashboard/alerts');
  }, [loading, user, router]);

  const load = useCallback(async (status: FilterStatus) => {
    setFetching(true); setError('');
    try {
      const res = await fetch(`/api/alerts?mine=true&status=${status}`);
      if (!res.ok) throw new Error('Failed');
      const d = await res.json();
      setAlerts(d.alerts ?? []);
      setTotal(d.total ?? 0);
      setCounts(prev => ({ ...prev, [status]: d.total ?? 0 }));
    } catch {
      setError('Could not load your alerts');
    } finally {
      setFetching(false);
    }
  }, []);

  // Load counts for all three statuses on mount so buttons show numbers immediately
  useEffect(() => {
    if (!user) return;
    Promise.all(
      (['pending', 'masked', 'passed'] as FilterStatus[]).map(s =>
        fetch(`/api/alerts?mine=true&status=${s}`)
          .then(r => r.ok ? r.json() : { total: 0 })
          .then(d => [s, d.total ?? 0] as [FilterStatus, number])
          .catch(() => [s, 0] as [FilterStatus, number])
      )
    ).then(results => {
      setCounts(Object.fromEntries(results) as Counts);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    load(filterStatus);
  }, [user, filterStatus, load]);

  const handleAppealed = (id: string) => {
    setAlerts(prev => prev.map(a =>
      a.id === id ? { ...a, appeal_status: 'sent' as const, appeal_at: new Date().toISOString() } : a,
    ));
  };

  if (loading || !user) return null;

  return (
    <div className="px-6 py-8 max-w-none">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Alerts</h1>
        <p className="text-sm text-slate-500 mt-1">Content you have submitted that triggered an automated scan alert</p>
      </div>

      {/* Status filter */}
      <div className="flex gap-1 mb-6">
        {(['pending', 'masked', 'passed'] as FilterStatus[]).map(s => {
          const n = counts[s];
          const label = s === 'pending' ? 'Pending review' : s === 'masked' ? 'Masked' : 'Passed';
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                filterStatus === s
                  ? 'bg-slate-700 text-slate-100'
                  : 'bg-slate-800/50 text-slate-500 hover:bg-slate-800 hover:text-slate-300'
              }`}
            >
              {label}{n > 0 ? ` (${n})` : ''}
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {fetching ? (
        <div className="space-y-3">
          {[0,1,2].map(i => <div key={i} className="h-32 rounded-xl bg-slate-800/40 animate-pulse" />)}
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-10 text-center">
          <svg className="h-10 w-10 mx-auto text-slate-700 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <p className="text-sm text-slate-400 font-medium">
            {filterStatus === 'pending' ? 'No alerts pending review' :
             filterStatus === 'passed'  ? 'No passed alerts' :
                                          'No masked content'}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {filterStatus === 'pending'
              ? 'Content you submit is automatically scanned. Any alerts will appear here.'
              : filterStatus === 'passed'
              ? 'Alerts that a moderator has reviewed and cleared.'
              : 'Content masked by a moderator will appear here. You can appeal the decision.'}
          </p>
          {filterStatus === 'masked' && (
            <p className="text-xs text-slate-600 mt-2">
              If you have an appeal concern, you can reach the platform admin team via{' '}
              <Link href="/contact" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
                Contact Us
              </Link>
              .
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {total > alerts.length && (
            <p className="text-xs text-slate-600 mb-2">Showing {alerts.length} of {total}</p>
          )}
          {alerts.map(a => (
            <MyAlertCard key={a.id} alert={a} onAppealed={handleAppealed} />
          ))}
        </div>
      )}
    </div>
  );
}
