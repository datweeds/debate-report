'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { CONTENT_LABELS as SCAN_LABELS } from '@/lib/scanTargets';

// ── Types ─────────────────────────────────────────────────────────────────────

type ContentAlert = {
  id: string;
  content_type: string;
  content_href?: string | null;
  society_name?: string | null;
  content_id: string | null;
  resolution_id: string | null;
  flagged_text: string | null;
  flags: string[];
  status: string;
  content_hidden?: boolean;      // private Society, no break-glass: Sys Admin sees only that it exists
  reporter_handle?: string | null;
  report_reason?: string | null;
  urgent?: boolean; report_route?: string | null; item_label?: string | null; maskable?: boolean;
  created_at: string;
  reviewed_at: string | null;
  appeal_body: string | null;
  appeal_at: string | null;
  appeal_status: string;
  author_handle: string | null;
  author_email: string | null;
  reviewed_by_handle: string | null;
  statement_title: string | null;
  resolution_title: string | null;
  owner_handle: string | null;
  owner_email: string | null;
};

type StatFlag = {
  id: string;
  stat_id: string;
  reason: string;
  created_at: string;
  flagger_handle: string | null;
  flagger_email: string | null;
  author_handle: string | null;
  author_email: string | null;
  owner_handle: string | null;
  owner_email: string | null;
  statement_title: string | null;
  resolution_id: string | null;
  resolution_title: string | null;
  total_flags: number;
  resolved_at?: string | null;
  resolver_handle?: string | null;
};

// ── Email parties ─────────────────────────────────────────────────────────────
// A moderator needs to reach the debate owner, the content author, and (for
// user-reported flags) whoever flagged it — if each has an email on file.

type EmailTarget = { label: string; email: string; handle: string | null };

function EmailModal({
  targets, defaultSubject, defaultBody, onClose,
}: {
  targets: EmailTarget[];
  defaultSubject: string;
  defaultBody: string;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(targets.map(t => t.email)));
  const [subject,  setSubject]  = useState(defaultSubject);
  const [body,     setBody]     = useState(defaultBody);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl border border-slate-700 bg-dr-card w-full max-w-xl p-6 relative flex flex-col gap-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
            <p className="text-xs text-slate-600">No email addresses available for this item.</p>
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

function EmailPartiesButton({ targets, defaultSubject, defaultBody }: { targets: EmailTarget[]; defaultSubject: string; defaultBody: string }) {
  const [open, setOpen] = useState(false);
  const hasEmail = targets.length > 0;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
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
      {open && (
        <EmailModal targets={targets} defaultSubject={defaultSubject} defaultBody={defaultBody} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FLAG_COLOURS: Record<string, string> = {
  profanity:   'bg-orange-500/20 text-orange-300 border-orange-500/40',
  hate_speech: 'bg-red-600/20 text-red-300 border-red-500/40',
  pii:         'bg-violet-500/20 text-violet-300 border-violet-500/40',
  reported:    'bg-amber-500/20 text-amber-300 border-amber-500/40',
};

const FLAG_LABELS: Record<string, string> = {
  profanity:   'Profanity',
  hate_speech: 'Hate Speech',
  pii:         'Personal Data',
  reported:      'Reported',
  inappropriate: 'Inappropriate',
  illegal:       'Possibly illegal',
  harassment:    'Harassment',
  spam:          'Spam',
  personal_data: 'Personal Data',
  other:         'Other',
};

const REASON_LABELS: Record<string, string> = {
  inappropriate: 'Inappropriate / Offensive',
  hate_speech:   'Hate Speech',
  personal_data: 'Personal Data',
};

// Labels for every kind of scanned content (debates, discussions, documents, …)
const CONTENT_LABELS: Record<string, string> = SCAN_LABELS;

function timeAgo(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function truncate(s: string | null | undefined, n = 140) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// ── Pending appeal banner ─────────────────────────────────────────────────────

function AppealBanner({ alert, onHandled }: { alert: ContentAlert; onHandled: (id: string, outcome: string) => void }) {
  const [saving, setSaving] = useState(false);

  async function handle(outcome: 'unmasked' | 'closed') {
    setSaving(true);
    try {
      await fetch(`/api/alerts/${alert.id}/appeal`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome }),
      });
      onHandled(alert.id, outcome);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-700/40 bg-amber-900/10 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-xs font-semibold text-amber-300 uppercase tracking-wide">Appeal Pending</span>
        <span className="text-xs text-slate-500 ml-auto">{timeAgo(alert.appeal_at!)}</span>
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="rounded-full border bg-slate-700/50 text-slate-400 border-slate-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
          {alert.item_label ?? CONTENT_LABELS[alert.content_type] ?? alert.content_type}
        </span>
        {alert.author_handle && (
          <span className="text-xs text-slate-500">by <span className="text-slate-400">@{alert.author_handle}</span></span>
        )}
        {alert.resolution_title && (
          <a href={`/chamber?resolution=${alert.resolution_id}`} target="_blank"
            className="text-xs text-blue-400 hover:text-blue-300">
            {truncate(alert.resolution_title, 50)}
          </a>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold">Masked content</p>
        <blockquote className="rounded-lg border-l-2 border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-400 italic">
          {truncate(alert.flagged_text)}
        </blockquote>
        <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold mt-2">User&apos;s appeal</p>
        <blockquote className="rounded-lg border-l-2 border-amber-700/50 bg-amber-900/10 px-3 py-2 text-sm text-slate-200 leading-relaxed">
          {alert.appeal_body}
        </blockquote>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => handle('unmasked')}
          disabled={saving}
          className="rounded-lg border border-emerald-700/50 bg-emerald-700/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-700/30 disabled:opacity-40 transition-colors"
        >
          {saving ? 'Saving…' : 'Unmask Content'}
        </button>
        <button
          onClick={() => handle('closed')}
          disabled={saving}
          className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-colors"
        >
          Close Appeal
        </button>
      </div>
    </div>
  );
}

// ── Scanner alert card ────────────────────────────────────────────────────────

function ScannerCard({ alert, onAction }: { alert: ContentAlert; onAction: (id: string, status: string) => void }) {
  const [saving,     setSaving]     = useState(false);
  const [confirming, setConfirming] = useState(false);

  const emailTargets: EmailTarget[] = [];
  if (alert.owner_email)  emailTargets.push({ label: 'Debate owner',     email: alert.owner_email,  handle: alert.owner_handle });
  if (alert.author_email) emailTargets.push({ label: 'Content author',  email: alert.author_email, handle: alert.author_handle });
  const emailSubject = `new.vote — Content Alert on "${truncate(alert.resolution_title ?? alert.statement_title ?? 'your debate', 60)}"`;
  const emailBody =
    `Hello,\n\nA content alert has been raised on new.vote regarding content in the debate:\n"${alert.resolution_title ?? alert.statement_title ?? ''}"\n\n` +
    `Our automated scanner flagged the following text:\n"${alert.flagged_text}"\n\nFlags: ${alert.flags.map(f => FLAG_LABELS[f] ?? f).join(', ')}\n\n` +
    `Please review your content and ensure it complies with our community guidelines.\n\nKind regards,\nnew.vote`;

  async function act(status: string) {
    if (status === 'masked' && !confirming) { setConfirming(true); return; }
    setSaving(true);
    setConfirming(false);
    try {
      await fetch(`/api/alerts/${alert.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      onAction(alert.id, status);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`rounded-xl border ${alert.urgent ? 'border-red-600/60' : 'border-slate-800'} bg-dr-card p-4 space-y-3`}>
      {alert.urgent && <p className="text-xs font-bold uppercase tracking-wide text-red-400">Urgent: reported as possibly illegal</p>}
      {alert.report_route === 'platform' && <p className="text-xs font-semibold text-violet-300">For the new.vote team only: the Society’s admins and the author can’t see this report</p>}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="rounded-full border bg-slate-700/50 text-slate-400 border-slate-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            {alert.item_label ?? CONTENT_LABELS[alert.content_type] ?? alert.content_type}
          </span>
          {alert.flags.map(f => (
            <span key={f} className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${FLAG_COLOURS[f] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
              {FLAG_LABELS[f] ?? f}
            </span>
          ))}
        </div>
        <span className="text-[11px] text-slate-600 whitespace-nowrap flex-shrink-0">{timeAgo(alert.created_at)}</span>
      </div>

      {alert.content_hidden ? (
        <p className="rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
          🔐 Private Society: the content is encrypted and handled by its Society Admins. You can see when they act on it;
          to see the content itself in an emergency, use Admin → Privacy.
        </p>
      ) : (
        <blockquote className="rounded-lg border-l-2 border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-300 leading-relaxed italic">
          {truncate(alert.flagged_text)}
        </blockquote>
      )}
      {alert.flags.includes('reported') && (
        <p className="text-xs text-amber-300">
          Reported by {alert.reporter_handle ? `@${alert.reporter_handle}` : 'someone (not shown)'}
          {alert.report_reason && <span className="text-slate-400">: “{truncate(alert.report_reason, 300)}”</span>}
        </p>
      )}
      {alert.status !== 'pending' && (
        <p className="text-xs text-slate-500">
          {alert.status === 'masked' ? 'Masked' : 'Passed'}{alert.reviewed_by_handle ? ` by @${alert.reviewed_by_handle}` : ''}{alert.reviewed_at ? `, ${timeAgo(alert.reviewed_at)}` : ''}
        </p>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {alert.author_handle && <span>By <span className="text-slate-400">@{alert.author_handle}</span></span>}
        {alert.society_name && <span>Society: <span className="text-slate-400">{alert.society_name}</span></span>}
        {!alert.resolution_title && alert.content_href && (
          <a href={alert.content_href} target="_blank" className="text-blue-400 hover:text-blue-300 transition-colors">View where it appears</a>
        )}
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
      </div>

      {!alert.content_hidden && alert.status === 'pending' && <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => act('passed')}
          disabled={saving}
          className="rounded-lg border border-emerald-700/50 bg-emerald-700/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-700/30 disabled:opacity-40 transition-colors"
        >
          Pass
        </button>

        {alert.maskable === false ? null : confirming ? (
          <>
            <span className="text-xs text-amber-400">Replace content with mask text?</span>
            <button
              onClick={() => act('masked')}
              disabled={saving}
              className="rounded-lg border border-red-600/60 bg-red-600/20 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-600/30 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Masking…' : 'Confirm Mask'}
            </button>
            <button onClick={() => setConfirming(false)} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => act('masked')}
            disabled={saving}
            className="rounded-lg border border-amber-700/50 bg-amber-700/15 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-700/25 disabled:opacity-40 transition-colors"
          >
            Mask Content
          </button>
        )}

        <EmailPartiesButton targets={emailTargets} defaultSubject={emailSubject} defaultBody={emailBody} />
      </div>}
    </div>
  );
}

// ── Stat flag card ────────────────────────────────────────────────────────────

function StatFlagCard({ flag, onCleared }: { flag: StatFlag; onCleared: (id: string) => void }) {
  const [clearing, setClearing] = useState(false);
  const [clearErr, setClearErr] = useState('');
  async function clear() {
    setClearing(true); setClearErr('');
    const r = await fetch('/api/alerts/flags', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: flag.id }) });
    setClearing(false);
    if (r.ok) { onCleared(flag.id); window.dispatchEvent(new Event('dr:alerts-changed')); }
    else setClearErr((await r.json().catch(() => ({}))).error ?? 'Could not clear the flag');
  }
  const emailTargets: EmailTarget[] = [];
  if (flag.owner_email)   emailTargets.push({ label: 'Debate owner',  email: flag.owner_email,   handle: flag.owner_handle });
  if (flag.author_email)  emailTargets.push({ label: 'Content author', email: flag.author_email, handle: flag.author_handle });
  if (flag.flagger_email) emailTargets.push({ label: 'Flag reporter', email: flag.flagger_email, handle: flag.flagger_handle });
  const emailSubject = `new.vote — Content Alert on "${truncate(flag.resolution_title ?? flag.statement_title ?? 'your debate', 60)}"`;
  const emailBody =
    `Hello,\n\nA content alert has been raised on new.vote regarding content in the debate:\n"${flag.resolution_title ?? flag.statement_title ?? ''}"\n\n` +
    `A user reported this statement for: ${REASON_LABELS[flag.reason] ?? flag.reason}\n\n` +
    `Please review your content and ensure it complies with our community guidelines.\n\nKind regards,\nnew.vote`;

  return (
    <div className="rounded-xl border border-slate-800 bg-dr-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${FLAG_COLOURS[flag.reason === 'personal_data' ? 'pii' : flag.reason] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
          {REASON_LABELS[flag.reason] ?? flag.reason}
        </span>
        <span className="text-[11px] text-slate-600 whitespace-nowrap flex-shrink-0">{timeAgo(flag.created_at)}</span>
      </div>
      {flag.statement_title && (
        <p className="text-sm text-slate-300 leading-snug font-medium">{truncate(flag.statement_title)}</p>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {flag.author_handle && <span>By <span className="text-slate-400">@{flag.author_handle}</span></span>}
        <span>Flagged by <span className="text-slate-400">{flag.flagger_handle ? `@${flag.flagger_handle}` : 'Anonymous'}</span></span>
        <span>Total flags: <span className="text-red-300">{flag.total_flags}</span></span>
        {flag.resolution_title && (
          <span>
            Debate:{' '}
            <a href={`/chamber?resolution=${flag.resolution_id}`} target="_blank"
              className="text-blue-400 hover:text-blue-300 transition-colors">
              {truncate(flag.resolution_title, 60)}
            </a>
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {flag.resolved_at ? (
          <span className="rounded-full border border-emerald-600/40 bg-emerald-600/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
            Cleared{flag.resolver_handle ? ` by @${flag.resolver_handle}` : ''} · {new Date(flag.resolved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        ) : (
          <button onClick={clear} disabled={clearing} title="Reviewed: no action needed. Closes this flag."
            className="rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/20 disabled:opacity-50 transition-colors">
            {clearing ? 'Clearing…' : 'Clear (no action)'}
          </button>
        )}
        <EmailPartiesButton targets={emailTargets} defaultSubject={emailSubject} defaultBody={emailBody} />
        {clearErr && <span className="text-xs text-rose-300">{clearErr}</span>}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'scan' | 'user';
type AlertStatus = 'pending' | 'passed' | 'masked';

export default function ScannerPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [tab,           setTab]           = useState<Tab>('scan');
  const [alertStatus,   setAlertStatus]   = useState<AlertStatus>('pending');
  const [flagStatus,    setFlagStatus]    = useState<'open' | 'cleared'>('open');
  const [alerts,        setAlerts]        = useState<ContentAlert[]>([]);
  const [appeals,       setAppeals]       = useState<ContentAlert[]>([]);
  const [statFlags,     setStatFlags]     = useState<StatFlag[]>([]);
  const [alertsTotal,   setAlertsTotal]   = useState(0);
  const [flagsTotal,    setFlagsTotal]    = useState(0);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [flagsLoading,  setFlagsLoading]  = useState(false);
  const [error,         setError]         = useState('');
  const [accessDenied,  setAccessDenied]  = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login?next=/dashboard/scanner');
  }, [loading, user, router]);

  // Access is Society Admin/SysAdmin-only, enforced server-side per the
  // viewer's current Society — the fetch itself is the gate; a 403 here
  // means they're not an admin for whichever Society they're currently on.
  const loadAlerts = useCallback(async (status: AlertStatus) => {
    setAlertsLoading(true); setError('');
    try {
      const res = await fetch(`/api/alerts?status=${status}`);
      if (res.status === 403) { setAccessDenied(true); return; }
      if (!res.ok) throw new Error('Failed');
      const d = await res.json();
      setAlerts(d.alerts ?? []);
      setAlertsTotal(d.total ?? 0);
    } catch {
      setError('Could not load alerts');
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  // Load pending appeals (masked items with appeal_status = 'sent')
  const loadAppeals = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts?status=masked');
      if (!res.ok) return;
      const d = await res.json();
      setAppeals((d.alerts ?? []).filter((a: ContentAlert) => a.appeal_status === 'sent'));
    } catch { /* silent */ }
  }, []);

  const loadFlags = useCallback(async (status: 'open' | 'cleared' = 'open') => {
    setFlagsLoading(true);
    try {
      const res = await fetch(`/api/alerts/flags?status=${status}`);
      if (!res.ok) throw new Error('Failed');
      const d = await res.json();
      setStatFlags(d.flags ?? []);
      if (status === 'open') setFlagsTotal(d.total ?? 0);   // the tab's badge counts open flags
    } catch { /* silent */ }
    finally { setFlagsLoading(false); }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadAlerts(alertStatus);
    loadAppeals();
  }, [user, alertStatus, loadAlerts, loadAppeals]);

  useEffect(() => {
    if (!user) return;
    loadFlags(flagStatus);
  }, [user, loadFlags, flagStatus]);

  const handleAlertAction = (id: string) => {
    const left = alerts.filter(a => a.id !== id);
    setAlerts(left);
    setAlertsTotal(t => Math.max(0, t - 1));
    window.dispatchEvent(new Event('dr:alerts-changed'));
    // The server sends alerts a page at a time: load the next page once this one is done
    if (left.length === 0 && alertsTotal - 1 > 0) void loadAlerts(alertStatus);
  };

  const handleAppealHandled = (id: string) => {
    setAppeals(prev => prev.filter(a => a.id !== id));
    window.dispatchEvent(new Event('dr:alerts-changed'));
  };

  if (loading || !user) return null;

  if (accessDenied) {
    return (
      <div className="px-6 py-8 max-w-lg">
        <p className="text-sm text-slate-400">
          Alert review is available to Society Admins (for their own Society) and SysAdmins only.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-none">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Alert Review</h1>
        <p className="text-sm text-slate-500 mt-1">
          Reports from members and visitors, the abuse scanner’s alerts, and debate statement flags, for your current Society
          {user.isSysAdmin ? ' — showing all Societies as SysAdmin' : ''}.
        </p>
      </div>

      {/* Pending appeals — always shown at top */}
      {appeals.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-amber-300 mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            Pending Appeals ({appeals.length})
          </h2>
          <div className="space-y-3">
            {appeals.map(a => (
              <AppealBanner key={a.id} alert={a} onHandled={handleAppealHandled} />
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-800">
        <button
          onClick={() => setTab('scan')}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
            tab === 'scan'
              ? 'border-amber-400 text-amber-300'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          Reports &amp; scanner
          {alertsTotal > 0 && (
            <span className="ml-2 rounded-full bg-orange-500/20 text-orange-300 text-[10px] px-1.5 py-0.5">{alertsTotal}</span>
          )}
        </button>
        <button
          onClick={() => setTab('user')}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
            tab === 'user'
              ? 'border-amber-400 text-amber-300'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          Statement flags
          {flagsTotal > 0 && (
            <span className="ml-2 rounded-full bg-red-500/20 text-red-300 text-[10px] px-1.5 py-0.5">{flagsTotal}</span>
          )}
        </button>
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {/* Auto-detected tab */}
      {tab === 'scan' && (
        <div className="space-y-4">
          <div className="flex gap-1">
            {(['pending', 'passed', 'masked'] as AlertStatus[]).map(s => (
              <button
                key={s}
                onClick={() => setAlertStatus(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  alertStatus === s
                    ? 'bg-slate-700 text-slate-100'
                    : 'bg-slate-800/50 text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {alertsLoading ? (
            <div className="space-y-3">
              {[0,1,2].map(i => <div key={i} className="h-32 rounded-xl bg-slate-800/40 animate-pulse" />)}
            </div>
          ) : alerts.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-dr-card p-10 text-center">
              <svg className="h-10 w-10 mx-auto text-slate-700 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <p className="text-sm text-slate-400 font-medium">No {alertStatus} alerts</p>
              <p className="text-xs text-slate-600 mt-1">
                {alertStatus === 'pending'
                  ? 'New content is scanned automatically as it is submitted'
                  : alertStatus === 'passed'
                  ? 'Content reviewed and cleared by a Society Admin'
                  : 'Content that has been masked in the chamber'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map(a => (
                <ScannerCard key={a.id} alert={a} onAction={handleAlertAction} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* User-reported tab */}
      {tab === 'user' && (
        <div className="space-y-3">
          <div className="flex gap-1">
            {(['open', 'cleared'] as const).map(s => (
              <button key={s} onClick={() => setFlagStatus(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  flagStatus === s ? 'bg-slate-700 text-slate-100' : 'bg-slate-800/50 text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>
                {s}
              </button>
            ))}
          </div>
          {flagsLoading ? (
            <div className="space-y-3">
              {[0,1,2].map(i => <div key={i} className="h-28 rounded-xl bg-slate-800/40 animate-pulse" />)}
            </div>
          ) : statFlags.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-dr-card p-10 text-center">
              <p className="text-sm text-slate-400 font-medium">{flagStatus === 'cleared' ? 'No cleared flags' : 'No open user-reported flags'}</p>
              <p className="text-xs text-slate-600 mt-1">{flagStatus === 'cleared' ? 'Flags a Society Admin has cleared are kept here as a record' : 'Statements flagged by users will appear here'}</p>
            </div>
          ) : (
            statFlags.map(f => <StatFlagCard key={f.id} flag={f} onCleared={id => { setStatFlags(fs => fs.filter(x => x.id !== id)); setFlagsTotal(n => Math.max(0, n - 1)); }} />)
          )}
        </div>
      )}
    </div>
  );
}
