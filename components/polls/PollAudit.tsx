'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { btnPrimary, card, inputCls, receiptHash, rememberedReceipts } from './shared';

// The audit log: every ballot's receipt hash. Voters check theirs is counted; anyone can count them.
export default function PollAudit({ societyId, pollId }: { societyId: number; pollId: string }) {
  const [log, setLog] = useState<{ title: string; status: string; counted: string[]; replaced: string[]; voters: number } | null>(null);
  const [receipt, setReceipt] = useState('');
  const [found, setFound] = useState<{ hash: string; where: 'counted' | 'replaced' | 'none' } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch(`/api/societies/${societyId}/polls/${pollId}/audit`).then(async r => r.ok ? setLog(await r.json()) : setError('Could not load the audit log.'));
    const mine = rememberedReceipts(pollId);
    if (mine[0]) setReceipt(mine[0]);
  }, [societyId, pollId]);

  async function check() {
    setError('');
    const h = await receiptHash(receipt);
    if (!h) { setError('A receipt is 32 letters and digits.'); return; }
    setFound({ hash: h, where: log!.counted.includes(h) ? 'counted' : log!.replaced.includes(h) ? 'replaced' : 'none' });
    setTimeout(() => document.getElementById(`h-${h}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
  }

  if (error && !log) return <p className="text-sm text-rose-300">{error}</p>;
  if (!log) return <div className="h-40 rounded-2xl bg-slate-800/40 animate-pulse" />;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href={`/society/${societyId}/polls/${pollId}`} className="text-xs text-slate-500 hover:text-slate-300">← {log.title}</Link>
        <h1 className="mt-2 text-lg font-semibold text-slate-100">Audit log</h1>
        <p className="mt-1 text-sm text-slate-400">
          Every ballot is listed by the scrambled (SHA-256) form of its voter’s receipt. Nobody, including us, can tell whose receipt is whose.
          {' '}<strong className="text-slate-200">{log.counted.length}</strong> ballots are counted for <strong className="text-slate-200">{log.voters}</strong> voters
          {log.counted.length === log.voters ? ' ✓' : ' ✕'}.
        </p>
      </div>
      <div className={`${card} space-y-2`}>
        <p className="text-sm font-medium text-slate-200">Check my receipt</p>
        <div className="flex gap-2">
          <input value={receipt} onChange={e => { setReceipt(e.target.value); setFound(null); }} placeholder="Paste your vote receipt" className={`${inputCls} font-mono`} />
          <button className={btnPrimary} onClick={check} disabled={!receipt.trim()}>Check</button>
        </div>
        <p className="text-[11px] text-slate-500">Your receipt is scrambled here, in your browser; it is never sent to us.</p>
        {error && <p className="text-xs text-rose-300">{error}</p>}
        {found && (
          <p className={`text-sm ${found.where === 'counted' ? 'text-emerald-300' : found.where === 'replaced' ? 'text-amber-300' : 'text-rose-300'}`}>
            {found.where === 'counted' ? '✓ Your ballot is in the count.' : found.where === 'replaced' ? 'This ballot was replaced when you changed your vote; your newer receipt is the one counted.' : '✕ Not found. Check you pasted the whole receipt for this poll.'}
          </p>
        )}
      </div>
      <div className={card}>
        <p className="mb-2 text-sm font-medium text-slate-200">Counted ({log.counted.length})</p>
        <ul className="max-h-[50vh] space-y-0.5 overflow-auto font-mono text-[11px] text-slate-400">
          {log.counted.map(h => <li key={h} id={`h-${h}`} className={found?.hash === h ? 'rounded bg-emerald-500/20 text-emerald-200' : ''}>{h}</li>)}
        </ul>
        {log.replaced.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-slate-500">Replaced by a later vote ({log.replaced.length})</summary>
            <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-slate-600">
              {log.replaced.map(h => <li key={h} id={`h-${h}`} className={found?.hash === h ? 'rounded bg-amber-500/20 text-amber-200' : ''}>{h}</li>)}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
