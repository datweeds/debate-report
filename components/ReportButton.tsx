'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

// "Report" on any item (an event, a reply, a document…): a reason and an
// optional note go to the Society's moderators, or to the new.vote team for
// possibly illegal content. Works without an account (5 reports a day).
const REASONS: [string, string][] = [
  ['inappropriate', 'Inappropriate or offensive'],
  ['harassment', 'Harassment or bullying'],
  ['hate_speech', 'Hate speech'],
  ['personal_data', 'Shares someone’s personal data'],
  ['spam', 'Spam or a scam'],
  ['underage', 'The person who wrote it may be under 16'],
  ['illegal', 'Possibly illegal: terrorism, child abuse, threats, fraud'],
  ['other', 'Something else'],
];

type Props = {
  kind: string;               // lib/reports.ts REPORT_KINDS
  id: string;
  what?: string;              // "this event"
  share?: string;             // a share link's token, on a shared document
  shown?: () => string;       // the text as this person sees it: used when it's sealed and the server can't read it
  sealed?: boolean;           // say so in the dialog
  label?: string;
  className?: string;
};

export default function ReportButton({ kind, id, what = 'this', share, shown, sealed, label = 'Report', className }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [website, setWebsite] = useState('');   // never shown: bots fill it in
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  function start(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setReason(''); setNote(''); setDone(null); setError(''); setOpen(true);
  }

  async function send() {
    if (!reason) return;
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id, reason, note, share, website, shown: shown?.() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error ?? 'The report couldn’t be sent.'); return; }
      setDone(d.route === 'platform'
        ? 'Thank you. The new.vote team will review it' + (reason === 'illegal' ? ' urgently.' : '.')
        : 'Thank you. This Society’s admins will review it.');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={start} title={`Report ${what}`}
        className={className ?? 'inline-flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-amber-300'}>
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
        </svg>
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div role="dialog" aria-modal="true" aria-label={`Report ${what}`}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-dr-card text-left shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
              <p className="text-sm font-semibold text-slate-100">Report {what}</p>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 px-5 py-4">
              {done ? (
                <>
                  <p className="text-sm text-slate-200">{done}</p>
                  <button onClick={() => setOpen(false)} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Close</button>
                </>
              ) : (
                <>
                  <div className="space-y-1.5" role="radiogroup" aria-label="Reason">
                    {REASONS.map(([v, l]) => (
                      <button key={v} type="button" role="radio" aria-checked={reason === v} onClick={() => setReason(v)}
                        className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors ${reason === v
                          ? (v === 'illegal' ? 'border-red-500/60 bg-red-500/15 text-red-200' : 'border-amber-500/50 bg-amber-500/10 text-amber-100')
                          : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={1000}
                    placeholder="Optional: anything the reviewers should know"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600" />
                  <input type="text" value={website} onChange={e => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off"
                    aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" />
                  <p className="text-xs leading-relaxed text-slate-500">
                    {reason === 'illegal'
                      ? 'This goes straight to the new.vote team, not the Society’s admins. If someone is in danger, call 999.'
                      : kind === 'society' || kind === 'profile'
                        ? 'This goes to the new.vote team.'
                        : 'This goes to the Society’s admins.'}
                    {' '}The person you report isn’t told who you are.
                    {!user && ' You’re not signed in: you can make up to 5 reports a day.'}
                    {sealed && ' This is sealed, so your report includes the text as you see it.'}
                  </p>
                  {error && <p className="text-xs text-rose-400">{error}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:bg-slate-800">Cancel</button>
                    <button onClick={send} disabled={!reason || busy}
                      className="flex-1 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-40">
                      {busy ? 'Sending…' : 'Send report'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
