'use client';

import { useState } from 'react';
import type { Answer, PollPayload } from '@/lib/polls/types';
import Ballot from './Ballot';
import { btnGhost, newReceipt, rememberReceipt } from './shared';

// Voting, then the receipt. Used by members and by access-code holders.
export default function VoteSection({ pollId, payload, open, voted, myBallot, canVote, allowRevote, seed, castUrl, extra, auditHref, onVoted, seal }: {
  pollId: string; payload: PollPayload; open: number; voted: boolean; myBallot: Answer[] | null; canVote: boolean; allowRevote: boolean;
  seed: string; castUrl: string; extra?: Record<string, unknown>; auditHref: string; onVoted: () => void;
  seal?: ((answers: Answer[]) => string) | null;   // a sealed poll: the ballot is encrypted here (null: no key yet)
}) {
  const [editing, setEditing] = useState(!voted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<string | null>(null);
  // A later question opened in a live poll: ask for the new answers
  const missing = voted && myBallot ? payload.questions.slice(0, open).some(q => !myBallot.some(a => a.questionId === q.id)) : false;

  async function cast(answers: Answer[]) {
    if (seal === null) { setError('You can’t vote until you have access to this sealed poll.'); return; }
    setBusy(true); setError('');
    const r0 = await newReceipt();
    const r = await fetch(castUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...extra, answers: seal ? seal(answers) : answers, receiptHash: r0.hash }) });
    setBusy(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error ?? 'Your vote could not be recorded.'); return; }
    rememberReceipt(pollId, r0.receipt);
    setReceipt(r0.receipt); setEditing(false);
    onVoted();
  }

  if (receipt) {
    return (
      <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <p className="text-sm font-semibold text-emerald-300">✓ Your vote has been recorded</p>
        <div>
          <p className="text-xs text-slate-400">Your vote receipt. Keep it to check your ballot is in the count:</p>
          <code className="mt-1 block break-all rounded bg-slate-900 px-2 py-1.5 font-mono text-sm text-slate-100">{receipt}</code>
          <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
            <button onClick={() => navigator.clipboard.writeText(receipt)} className="text-blue-400 hover:underline">Copy</button>
            {auditHref && <a href={auditHref} className="text-blue-400 hover:underline">Check it in the audit log →</a>}
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Only a scrambled (SHA-256) form of the receipt was sent with your ballot, so it proves your ballot is counted without showing anyone which one is yours.
          {allowRevote && ' If you change your vote, your new ballot replaces this one and you get a new receipt.'}
        </p>
        {canVote && allowRevote && <button className={btnGhost} onClick={() => { setReceipt(null); setEditing(true); }}>Change my vote</button>}
      </div>
    );
  }

  if (!canVote && !voted) return null;
  if (voted && !editing && !missing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
        <p className="text-sm text-emerald-300">✓ You have voted in this poll.</p>
        <div className="flex gap-3 text-xs">
          {auditHref && <a href={auditHref} className="text-blue-400 hover:underline">Audit log</a>}
          {canVote && allowRevote && <button className="text-blue-400 hover:underline" onClick={() => setEditing(true)}>Change my vote</button>}
        </div>
      </div>
    );
  }
  if (!canVote) return null;
  return (
    <div className="space-y-3">
      {missing && <p className="text-sm text-blue-300">A new question is open. Your earlier answers are filled in: add the new one and vote again.</p>}
      <Ballot payload={payload} open={open} initial={myBallot} seed={seed} busy={busy} error={error} onCast={cast}
        castLabel={voted ? 'Replace my vote' : 'Cast vote'} />
    </div>
  );
}
