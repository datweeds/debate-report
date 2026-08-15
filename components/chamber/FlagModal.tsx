'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

const REASON_LABELS: Record<string, string> = {
  inappropriate: 'Inappropriate, profane or offensive language',
  hate_speech:   'Hate Speech',
  personal_data: 'Contains personal data',
};

type Props = {
  statementId:    string;
  statementTitle: string;
  onClose:        () => void;
  onFlagChanged:  (flagCount: number) => void;
};

type FlagStatus = {
  flagCount:   number;
  userFlagged: boolean;
  reasons:     string[];
};

export default function FlagModal({ statementId, statementTitle, onClose, onFlagChanged }: Props) {
  const { user } = useAuth();
  const [status,    setStatus]    = useState<FlagStatus | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [reason,    setReason]    = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [removing,  setRemoving]  = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState(false);
  const [removed,   setRemoved]   = useState(false);

  useEffect(() => {
    fetch(`/api/statements/${statementId}/flag`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStatus(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [statementId]);

  async function handleRemove() {
    setRemoving(true); setError('');
    try {
      const res = await fetch(`/api/statements/${statementId}/flag`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? 'Failed to remove flag'); return; }
      setRemoved(true);
      setStatus(prev => prev ? { ...prev, flagCount: d.flagCount, userFlagged: false } : prev);
      onFlagChanged(d.flagCount);
    } catch {
      setError('Network error');
    } finally {
      setRemoving(false);
    }
  }

  async function handleSubmit() {
    if (!reason) return;
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/statements/${statementId}/flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.alreadyFlagged ? 'You have already flagged this statement.' : (d.error ?? 'Failed to flag'));
        return;
      }
      setSuccess(true);
      setStatus(prev => prev ? { ...prev, flagCount: d.flagCount, userFlagged: true } : prev);
      onFlagChanged(d.flagCount);
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-700 bg-[#0c1322] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-800">
          <div className="min-w-0 pr-4">
            <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-1">Flag Statement</p>
            <h3 className="text-sm font-semibold text-slate-100 leading-snug line-clamp-2">{statementTitle}</h3>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 rounded-lg p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {loading ? (
            <div className="space-y-2 py-2">
              {[0,1,2].map(i => <div key={i} className="h-12 rounded-xl bg-slate-800/60 animate-pulse" />)}
            </div>
          ) : success ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-5 text-center space-y-2">
              <div className="flex justify-center">
                <svg className="h-8 w-8 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-red-300">Flag submitted</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Thank you for helping keep debates civil. A moderator will review this statement.
              </p>
              {status && (
                <p className="text-xs text-slate-500">Total flags on this statement: {status.flagCount}</p>
              )}
              <button
                onClick={onClose}
                className="mt-1 rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Existing flag status */}
              {status && status.flagCount > 0 && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 space-y-1">
                  <p className="text-xs font-semibold text-red-300">
                    This statement has been flagged {status.flagCount} time{status.flagCount !== 1 ? 's' : ''}
                  </p>
                  {status.reasons.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {status.reasons.map(r => (
                        <span key={r} className="rounded-full bg-red-900/40 border border-red-700/40 px-2 py-0.5 text-[10px] text-red-300">
                          {REASON_LABELS[r] ?? r}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {removed ? (
                <div className="rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-5 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-300">Flag removed</p>
                  <p className="text-xs text-slate-500">Your flag on this statement has been withdrawn.</p>
                  <button onClick={onClose} className="mt-1 rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:bg-slate-800 transition-colors">
                    Close
                  </button>
                </div>
              ) : status?.userFlagged ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                    <p className="text-xs font-semibold text-red-300">You have flagged this statement.</p>
                    {status.flagCount > 1 && (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {status.flagCount - 1} other flag{status.flagCount - 1 !== 1 ? 's' : ''} also on record.
                      </p>
                    )}
                  </div>
                  {error && <p className="text-xs text-red-400">{error}</p>}
                  <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 transition-colors">
                      Close
                    </button>
                    <button
                      onClick={handleRemove}
                      disabled={removing}
                      className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-slate-100 disabled:opacity-40 transition-colors"
                    >
                      {removing ? 'Removing…' : 'Remove my flag'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-slate-400 leading-relaxed mb-3">
                      Flagging a statement alerts moderators to review it for policy violations.
                      Please select the most appropriate reason:
                    </p>
                    <div className="space-y-2">
                      {Object.entries(REASON_LABELS).map(([value, label]) => (
                        <button
                          key={value}
                          onClick={() => setReason(value)}
                          className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition-all ${
                            reason === value
                              ? 'border-red-500/50 bg-red-500/15 text-red-200'
                              : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {!user && (
                    <p className="text-xs text-slate-500 text-center">
                      You are flagging anonymously. Log in to track your flags.
                    </p>
                  )}

                  {error && <p className="text-xs text-red-400">{error}</p>}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={onClose}
                      className="flex-1 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={!reason || saving}
                      className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40 transition-colors"
                    >
                      {saving ? 'Flagging…' : 'Flag Statement'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
