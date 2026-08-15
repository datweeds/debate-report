'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Resolution = 'closed' | 'debate' | 'vote';

type Props = {
  proposalId: number;
  status: string;
  title: string;
  description: string;
  rejectionReason: string | null;
  nextAction: string | null;
  isOwner: boolean;
  isSysAdmin: boolean;
};

const RESOLUTION_CONFIG: Record<Resolution, { label: string; verb: string; btnCls: string; confirmCls: string; placeholder: string }> = {
  closed: {
    label:       'Close Proposal',
    verb:        'Close',
    btnCls:      'border border-slate-500/30 bg-slate-500/10 text-slate-300 hover:bg-slate-500/20',
    confirmCls:  'bg-slate-600 hover:bg-slate-500',
    placeholder: 'Provide a closing statement explaining the outcome…',
  },
  debate: {
    label:       'Open for Debate',
    verb:        'Open Debate',
    btnCls:      'border border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20',
    confirmCls:  'bg-blue-600 hover:bg-blue-500',
    placeholder: 'Provide an opening statement for the debate…',
  },
  vote: {
    label:       'Put to Vote',
    verb:        'Put to Vote',
    btnCls:      'border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20',
    confirmCls:  'bg-amber-600 hover:bg-amber-500',
    placeholder: 'Provide a statement explaining what is being voted on…',
  },
};

export default function ProposalActions({
  proposalId, status, title, description, rejectionReason, nextAction, isOwner, isSysAdmin,
}: Props) {
  const router = useRouter();
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');
  const [showReject, setShowReject] = useState(false);
  const [reason,     setReason]     = useState('');
  const [showAmend,  setShowAmend]  = useState(false);
  const [amendTitle, setAmendTitle] = useState(title);
  const [amendDesc,  setAmendDesc]  = useState(description);
  const [resolving,  setResolving]  = useState<Resolution | null>(null);
  const [statement,  setStatement]  = useState('');
  const [closesAt,   setClosesAt]   = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });

  async function patch(body: object) {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/proposals/${proposalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Action failed.');
        return;
      }
      router.refresh();
      setShowReject(false);
      setShowAmend(false);
      setResolving(null);
      setStatement('');
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  function startResolving(r: Resolution) {
    setResolving(r);
    setStatement('');
    setShowReject(false);
    if (r !== 'vote') setClosesAt('');
  }

  const canAct     = isSysAdmin && (status === 'proposed' || status === 'amended');
  const canResolve = isSysAdmin && status === 'accepted' && !nextAction;
  const canAmend   = isOwner && status === 'rejected';

  if (!canAct && !canResolve && !canAmend) return null;

  return (
    <div className="mt-6 space-y-4">
      {error && (
        <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-400">
          {error}
        </p>
      )}

      {/* ── SysAdmin: accept / reject */}
      {canAct && !showReject && (
        <div className="card-dr px-5 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Review Actions</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => patch({ action: 'accept' })}
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? '…' : 'Accept Proposal'}
            </button>
            <button
              onClick={() => setShowReject(true)}
              disabled={saving}
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-400 transition-colors hover:bg-rose-500/20"
            >
              Reject…
            </button>
          </div>
        </div>
      )}

      {canAct && showReject && (
        <div className="card-dr px-5 py-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rejection Reason</p>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={4}
            placeholder="Explain why this proposal is being rejected…"
            className="w-full rounded-lg border border-blue-900/30 bg-slate-800/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500/50 focus:outline-none resize-y"
          />
          <div className="flex gap-3">
            <button
              onClick={() => patch({ action: 'reject', reason })}
              disabled={saving || !reason.trim()}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:opacity-50"
            >
              {saving ? '…' : 'Confirm Rejection'}
            </button>
            <button
              onClick={() => { setShowReject(false); setReason(''); }}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── SysAdmin: resolve accepted proposal */}
      {canResolve && !resolving && (
        <div className="card-dr px-5 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Next Steps</p>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(RESOLUTION_CONFIG) as Resolution[]).map(r => (
              <button
                key={r}
                onClick={() => startResolving(r)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${RESOLUTION_CONFIG[r].btnCls}`}
              >
                {RESOLUTION_CONFIG[r].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {canResolve && resolving && (
        <div className="card-dr px-5 py-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {RESOLUTION_CONFIG[resolving].label} — Statement
          </p>
          <textarea
            value={statement}
            onChange={e => setStatement(e.target.value)}
            rows={5}
            placeholder={RESOLUTION_CONFIG[resolving].placeholder}
            className="w-full rounded-lg border border-blue-900/30 bg-slate-800/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500/50 focus:outline-none resize-y"
          />
          {resolving === 'vote' && (
            <div>
              <label className="block mb-1 text-xs text-slate-400">Voting closes on</label>
              <input
                type="date"
                value={closesAt}
                onChange={e => setClosesAt(e.target.value)}
                className="rounded-lg border border-blue-900/30 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 focus:border-blue-500/50 focus:outline-none [color-scheme:dark]"
              />
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => patch({ action: 'resolve', resolution: resolving, statement, closesAt: resolving === 'vote' ? closesAt : undefined })}
              disabled={saving || !statement.trim() || (resolving === 'vote' && !closesAt)}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${RESOLUTION_CONFIG[resolving].confirmCls}`}
            >
              {saving ? '…' : `Confirm — ${RESOLUTION_CONFIG[resolving].verb}`}
            </button>
            <button
              onClick={() => { setResolving(null); setStatement(''); }}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Proposer: amend rejected proposal */}
      {canAmend && rejectionReason && !showAmend && (
        <div className="card-dr px-5 py-4 space-y-3 border-rose-500/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-400">Rejection Reason</p>
          <p className="text-sm text-slate-300">{rejectionReason}</p>
          <button
            onClick={() => setShowAmend(true)}
            className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-300 transition-colors hover:bg-violet-500/20"
          >
            Amend and Resubmit
          </button>
        </div>
      )}

      {canAmend && !rejectionReason && !showAmend && (
        <button
          onClick={() => setShowAmend(true)}
          className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-300 transition-colors hover:bg-violet-500/20"
        >
          Amend and Resubmit
        </button>
      )}

      {canAmend && showAmend && (
        <div className="card-dr px-5 py-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Amend Proposal</p>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Title</label>
            <input
              value={amendTitle}
              onChange={e => setAmendTitle(e.target.value)}
              maxLength={200}
              className="w-full rounded-lg border border-blue-900/30 bg-slate-800/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
            <textarea
              value={amendDesc}
              onChange={e => setAmendDesc(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-blue-900/30 bg-slate-800/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500/50 focus:outline-none resize-y"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => patch({ action: 'amend', title: amendTitle, description: amendDesc })}
              disabled={saving || !amendTitle.trim() || !amendDesc.trim()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
            >
              {saving ? '…' : 'Resubmit'}
            </button>
            <button
              onClick={() => setShowAmend(false)}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
