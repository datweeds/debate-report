'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type PollInfo = {
  poll_id: string;       // pvc_poll_id from poll.voter.care
  title: string;
  status: string;        // 'open' | 'closed'
  vote_count: number;
  result_visibility: string; // 'live' | 'after_close' | 'never'
};

type Props = {
  poll: PollInfo | null;
  entityType: 'bill' | 'proposal';
  entityId: number;
  isSysAdmin: boolean;
};

const PVC_BASE = 'https://poll.voter.care';

function CopyButton({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/50 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-300"
    >
      {copied ? (
        <>
          <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-emerald-400">Copied!</span>
        </>
      ) : (
        <>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

export default function VoteSection({ poll, entityType, entityId, isSysAdmin }: Props) {
  const router = useRouter();
  const [linking, setLinking]   = useState(false);
  const [pollId, setPollId]     = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  async function linkPoll() {
    setSaving(true);
    setError('');
    const url = entityType === 'bill'
      ? `/api/scotparl/bills/${entityId}/vote`
      : `/api/scotparl/proposals/${entityId}/vote`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pollId }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Failed to link poll.');
    }
    setSaving(false);
  }

  async function unlinkPoll() {
    if (!confirm('Remove the poll link?')) return;
    const url = entityType === 'bill'
      ? `/api/scotparl/bills/${entityId}/vote`
      : `/api/scotparl/proposals/${entityId}/vote`;
    await fetch(url, { method: 'DELETE' });
    router.refresh();
  }

  // ── Existing poll ──
  if (poll) {
    const closed      = poll.status === 'closed';
    const voteUrl     = `${PVC_BASE}/vote/${poll.poll_id}`;
    const dashUrl     = `${PVC_BASE}/dashboard`;

    return (
      <div className="card-dr px-5 py-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Formal Vote</p>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
            closed
              ? 'bg-slate-500/10 text-slate-400 border-slate-600/30'
              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
          }`}>
            {closed ? 'Closed' : 'Open'}
          </span>
        </div>

        {poll.title && (
          <p className="text-sm text-slate-300 leading-snug">{poll.title}</p>
        )}

        {poll.vote_count > 0 && (
          <p className="text-xs text-slate-500">
            {poll.vote_count} {poll.vote_count === 1 ? 'vote' : 'votes'} cast
            {!closed && ' — results shown when the poll closes'}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <a
            href={voteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
              closed ? 'bg-slate-600 hover:bg-slate-500' : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {closed ? 'View Results' : 'Vote on poll.voter.care'}
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <CopyButton url={voteUrl} label="Copy vote link" />
          {isSysAdmin && (
            <>
              <a
                href={dashUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Manage Poll
              </a>
              <button
                onClick={unlinkPoll}
                className="text-xs text-slate-600 hover:text-rose-400 transition-colors"
              >
                Unlink
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── No poll yet — sysadmin link form ──
  if (!isSysAdmin) return null;

  return (
    <div className="card-dr px-5 py-4 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Formal Vote</p>

      {!linking ? (
        <button
          onClick={() => setLinking(true)}
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
        >
          Link poll.voter.care poll…
        </button>
      ) : (
        <div className="space-y-3">
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <div>
            <label className="block mb-1 text-xs text-slate-400">
              Poll ID{' '}
              <a href="https://poll.voter.care/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                (open poll.voter.care dashboard to copy it)
              </a>
            </label>
            <input
              value={pollId}
              onChange={e => setPollId(e.target.value)}
              className="w-full rounded-lg border border-blue-900/30 bg-slate-800/50 px-3 py-2 text-sm text-slate-100 font-mono focus:border-blue-500/50 focus:outline-none"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={linkPoll}
              disabled={saving || !pollId.trim()}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
            >
              {saving ? '…' : 'Link Poll'}
            </button>
            <button
              onClick={() => { setLinking(false); setError(''); setPollId(''); }}
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
