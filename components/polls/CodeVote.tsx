'use client';

import { useState } from 'react';
import type { PollResults } from '@/lib/polls/server';
import type { Answer, PollPayload, PollSettings } from '@/lib/polls/types';
import Results from './Results';
import VoteSection from './VoteSection';
import { btnGhost, btnPrimary, card, inputCls, receiptHash, rememberedReceipts } from './shared';

type Data = { society: string | null; poll: PollSettings & { id: string; payload: PollPayload; open_questions: number }; voted: boolean; myBallot: Answer[] | null; canVote: boolean; results: PollResults | null;
  audit: { counted: string[]; replaced: string[]; voters: number } | null };

// Voting with an access code, for people without an account.
export default function CodeVote({ pollId }: { pollId: string }) {
  const [code, setCode] = useState('');
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function enter(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true); setError('');
    const r = await fetch(`/api/polls/${pollId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? 'That code is not valid.'); return; }
    setD(j);
  }

  if (!d) {
    return (
      <form onSubmit={enter} className={`${card} mx-auto max-w-md space-y-3`}>
        <h1 className="text-lg font-semibold text-slate-100">Vote with your access code</h1>
        <p className="text-sm text-slate-400">Enter the code you were given. It works for this poll only.</p>
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX" autoComplete="off" spellCheck={false}
          className={`${inputCls} text-center font-mono text-lg tracking-widest`} />
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <button className={btnPrimary} disabled={busy || code.replace(/[^A-Z0-9]/g, '').length < 12}>{busy ? 'Checking…' : 'Continue'}</button>
      </form>
    );
  }
  const { poll } = d;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        {d.society && <p className="text-xs uppercase tracking-wider text-slate-500">{d.society}</p>}
        {poll.payload.headerImage && <img src={poll.payload.headerImage} alt="" className="mt-3 max-h-56 w-full rounded-xl object-cover" />}
        <h1 className="mt-2 text-xl font-semibold text-slate-100">{poll.payload.title}</h1>
        {poll.payload.description && <p className="mt-2 whitespace-pre-line text-sm text-slate-400">{poll.payload.description}</p>}
        <p className="mt-2 text-xs text-slate-500">{poll.ballot_mode === 'secret' ? '🔒 Secret ballot: no one can see who chose what.' : '👤 Named ballot: the organisers can see who chose what.'}</p>
      </div>
      {poll.status === 'open' ? (
        <div className={card}>
          <VoteSection pollId={poll.id} payload={poll.payload} open={poll.open_questions} voted={d.voted} myBallot={d.myBallot}
            canVote={d.canVote} allowRevote={poll.allow_revote} seed={`${code}:${poll.id}`} castUrl={`/api/polls/${pollId}/vote`} extra={{ code }}
            auditHref="" onVoted={() => void enter()} />
        </div>
      ) : <p className="text-sm text-slate-400">This poll is {poll.status === 'closed' ? 'closed' : 'not open yet'}.</p>}
      {d.audit && <ReceiptCheck pollId={pollId} audit={d.audit} />}
      {d.results && <div className={card}><Results results={d.results} payload={poll.payload} /></div>}
    </div>
  );
}

function ReceiptCheck({ pollId, audit }: { pollId: string; audit: NonNullable<Data['audit']> }) {
  const [receipt, setReceipt] = useState(() => rememberedReceipts(pollId)[0] ?? '');
  const [msg, setMsg] = useState('');
  return (
    <div className={`${card} space-y-2`}>
      <p className="text-sm font-medium text-slate-200">Check my vote is counted</p>
      <p className="text-xs text-slate-500">{audit.counted.length} ballots are counted for {audit.voters} voters. Your receipt is checked here, in your browser.</p>
      <div className="flex gap-2">
        <input value={receipt} onChange={e => { setReceipt(e.target.value); setMsg(''); }} placeholder="Your vote receipt" className={`${inputCls} font-mono`} />
        <button className={btnGhost} onClick={async () => {
          const h = await receiptHash(receipt);
          setMsg(!h ? 'A receipt is 32 letters and digits.' : audit.counted.includes(h) ? '✓ Your ballot is in the count.'
            : audit.replaced.includes(h) ? 'This ballot was replaced by your later vote.' : '✕ Not found for this poll.');
        }}>Check</button>
      </div>
      {msg && <p className="text-sm text-slate-200">{msg}</p>}
    </div>
  );
}
