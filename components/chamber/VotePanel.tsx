'use client';

import { useEffect, useState, useCallback } from 'react';

type VoteData = {
  userVote: 'agree' | 'disagree' | null;
  userImpact: number | null;
  userRationale: string | null;
  agreeCount: number;
  disagreeCount: number;
  totalFor: number;
  totalAgainst: number;
};

type Props = {
  statementId: string;
  statementTitle: string;
  userId: string | null;
  onClose: () => void;
};

const IMPACT_LABELS: Record<number, string> = {
  1: 'Negligible', 2: 'Negligible', 3: 'Low',
  4: 'Low',        5: 'Medium',     6: 'Medium',
  7: 'High',       8: 'High',       9: 'Critical',
  10: 'Critical',
};

export default function VotePanel({ statementId, statementTitle, userId, onClose }: Props) {
  const [data,         setData]         = useState<VoteData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');

  // Two-step flow state
  const [step,         setStep]         = useState<'vote' | 'impact'>('vote');
  const [pendingVote,  setPendingVote]  = useState<'agree' | 'disagree' | null>(null);
  const [impact,       setImpact]       = useState<number | null>(null);
  const [rationale,    setRationale]    = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/statements/${statementId}/vote`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        if (d.userImpact) setImpact(d.userImpact);
        if (d.userRationale) setRationale(d.userRationale);
        setLoading(false);
      })
      .catch(() => { setError('Could not load votes'); setLoading(false); });
  }, [statementId]);

  useEffect(() => { load(); }, [load]);

  async function castVote(vote: 'agree' | 'disagree' | null, imp?: number | null, rat?: string) {
    if (!userId) return;
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/statements/${statementId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote, impact: imp ?? null, rationale: rat ?? null }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Vote failed'); return; }
      const updated = await res.json();
      setData(updated);
      setStep('vote');
      setPendingVote(null);
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  function handleVoteClick(v: 'agree' | 'disagree') {
    if (data?.userVote === v) {
      // Same vote → remove immediately (no impact step)
      castVote(null);
    } else {
      // New or changed vote → go to impact step
      setPendingVote(v);
      setStep('impact');
    }
  }

  function handleEditImpact() {
    setPendingVote(data?.userVote ?? null);
    if (data?.userImpact) setImpact(data.userImpact);
    if (data?.userRationale) setRationale(data.userRationale ?? '');
    setStep('impact');
  }

  const totalVotes = (data?.agreeCount ?? 0) + (data?.disagreeCount ?? 0);
  const agreePercent = totalVotes > 0 ? Math.round((data!.agreeCount / totalVotes) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {step === 'impact' && (
            <button onClick={() => setStep('vote')} className="rounded p-1 text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </button>
          )}
          <svg className="h-4 w-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.253m0 0a2.25 2.25 0 0 1-2.25-2.25v-4a2.25 2.25 0 0 1 2.25-2.25h.254" />
          </svg>
          <h2 className="text-sm font-semibold text-slate-200">
            {step === 'impact' ? 'Rate Impact' : 'Vote'}
          </h2>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors flex-shrink-0">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Statement title */}
      <div className="px-4 py-3 border-b border-slate-800/60 flex-shrink-0">
        <p className="text-xs text-slate-500 mb-1">Statement</p>
        <p className="text-sm text-slate-300 leading-snug line-clamp-3">{statementTitle}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {loading ? (
          <p className="text-sm text-slate-500 text-center py-8">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-400 text-center py-8">{error}</p>
        ) : data && (
          <>
            {/* ── Step 1: Vote ─────────────────────────────────────────── */}
            {step === 'vote' && (
              <>
                {/* Current vote indicator */}
                {data.userVote && (
                  <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border text-sm font-semibold ${
                    data.userVote === 'agree'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      {data.userVote === 'agree'
                        ? <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        : <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />}
                    </svg>
                    You voted: {data.userVote === 'agree' ? 'Agree' : 'Disagree'}
                    <button onClick={() => castVote(null)} disabled={saving}
                      className="ml-auto text-xs underline opacity-70 hover:opacity-100">
                      Remove
                    </button>
                  </div>
                )}

                {/* Current impact/rationale display */}
                {data.userVote && (
                  <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Impact score
                      </span>
                      <button onClick={handleEditImpact}
                        className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
                        Edit
                      </button>
                    </div>
                    {data.userImpact ? (
                      <p className="text-sm text-slate-300 font-semibold">
                        {data.userImpact} — {IMPACT_LABELS[data.userImpact]}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 italic">Not rated yet</p>
                    )}
                    {data.userRationale && (
                      <>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-2">Rationale</p>
                        <p className="text-xs text-slate-400 leading-snug">{data.userRationale}</p>
                      </>
                    )}
                  </div>
                )}

                {/* Vote buttons */}
                {userId ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleVoteClick('agree')} disabled={saving}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 transition-all active:scale-95 ${
                        data.userVote === 'agree'
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-emerald-500/40 hover:text-emerald-300'
                      }`}>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.253m0 0a2.25 2.25 0 0 1-2.25-2.25v-4a2.25 2.25 0 0 1 2.25-2.25h.254" />
                      </svg>
                      <span className="text-xs font-bold">Agree</span>
                    </button>
                    <button onClick={() => handleVoteClick('disagree')} disabled={saving}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 transition-all active:scale-95 ${
                        data.userVote === 'disagree'
                          ? 'bg-rose-500/20 border-rose-500/50 text-rose-200'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-rose-500/40 hover:text-rose-300'
                      }`}>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715a12.137 12.137 0 0 1-.068-1.285c0-2.848.992-5.464 2.649-7.521C5.287 4.247 5.886 4 6.504 4h4.016a4.5 4.5 0 0 1 1.423.23l3.114 1.04a4.5 4.5 0 0 0 1.423.23h1.294M7.498 15.25c.618 0 .991.724.725 1.282A7.471 7.471 0 0 0 7.5 19.75 2.25 2.25 0 0 0 9.75 22a.75.75 0 0 0 .75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 0 0 2.861-2.4c.498-.634 1.226-1.08 2.032-1.08h.384m-10.253 1.5H9.7m8.075-9.75c.01.05.027.1.05.148.593 1.2.925 2.55.925 3.977 0 1.487-.36 2.89-.999 4.125m.023-8.25c-.076-.365.183-.75.575-.75h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398C20.613 14.547 19.833 15 19 15h-1.053c-.472 0-.745-.556-.5-.96a8.95 8.95 0 0 0 .303-.54" />
                      </svg>
                      <span className="text-xs font-bold">Disagree</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-2">Log in to vote</p>
                )}

                {/* Vote counts */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">This Statement</p>
                  <div className="flex gap-2 mb-1.5">
                    <div className="flex-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-center">
                      <p className="text-lg font-bold text-emerald-300">{data.agreeCount}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Agree</p>
                    </div>
                    <div className="flex-1 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-center">
                      <p className="text-lg font-bold text-rose-300">{data.disagreeCount}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Disagree</p>
                    </div>
                  </div>
                  {totalVotes > 0 && (
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${agreePercent}%` }} />
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">
                    Including Downstream (For/Against Resolution)
                  </p>
                  <div className="flex gap-2">
                    <div className="flex-1 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-center">
                      <p className="text-lg font-bold text-blue-300">{data.totalFor}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">For</p>
                    </div>
                    <div className="flex-1 rounded-lg bg-orange-500/10 border border-orange-500/20 px-3 py-2 text-center">
                      <p className="text-lg font-bold text-orange-300">{data.totalAgainst}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Against</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-slate-600 leading-snug">
                    Agree votes on For statements count For the resolution. Agree votes on Against statements count Against.
                  </p>
                </div>
              </>
            )}

            {/* ── Step 2: Impact ───────────────────────────────────────── */}
            {step === 'impact' && (
              <div className="space-y-5">
                {/* Pending vote preview */}
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border text-sm font-semibold ${
                  pendingVote === 'agree'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    {pendingVote === 'agree'
                      ? <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      : <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />}
                  </svg>
                  Voting: {pendingVote === 'agree' ? 'Agree' : 'Disagree'}
                </div>

                {/* Impact score */}
                <div>
                  <p className="text-xs font-semibold text-slate-300 mb-1">
                    How much does this statement impact the debate?
                  </p>
                  <p className="text-[10px] text-slate-500 mb-3">Rate on a scale of 1 (negligible) to 10 (critical)</p>
                  <div className="grid grid-cols-5 gap-1.5 mb-2">
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <button
                        key={n}
                        onClick={() => setImpact(n)}
                        className={`rounded-lg py-2 text-sm font-bold transition-all ${
                          impact === n
                            ? 'bg-amber-500/30 border border-amber-500/60 text-amber-200'
                            : 'bg-slate-800 border border-slate-700 text-slate-400 hover:border-amber-500/40 hover:text-amber-300'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  {impact && (
                    <p className="text-xs text-amber-300 font-semibold text-center">
                      {impact} — {IMPACT_LABELS[impact]}
                    </p>
                  )}
                </div>

                {/* Rationale */}
                <div>
                  <p className="text-xs font-semibold text-slate-300 mb-1">
                    Vote rationale <span className="text-slate-500 font-normal">(optional)</span>
                  </p>
                  <textarea
                    value={rationale}
                    onChange={e => setRationale(e.target.value)}
                    placeholder="Briefly explain your vote…"
                    maxLength={500}
                    rows={3}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-amber-500/40 focus:outline-none resize-none"
                  />
                  <p className="text-[10px] text-slate-600 text-right mt-0.5">{rationale.length}/500</p>
                </div>

                {/* Confirm button */}
                <button
                  onClick={() => castVote(pendingVote, impact, rationale)}
                  disabled={saving || !impact}
                  className="w-full rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-40 transition-colors"
                >
                  {saving ? 'Saving…' : 'Confirm Vote'}
                </button>
                {!impact && (
                  <p className="text-[10px] text-slate-500 text-center -mt-3">Select an impact score to continue</p>
                )}
                {error && <p className="text-xs text-red-400 text-center">{error}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
