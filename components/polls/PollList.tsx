'use client';

import Link from 'next/link';
import { useSecureAccess } from '@/components/sealed/useSecureAccess';
import { listKeys, type ItemKeys } from '@/components/sealed/items';
import { openPayload } from './sealedPoll';
import { useEffect, useState } from 'react';
import { Badge, btnPrimary, fmtWhen, POLL_STATUS } from './shared';

type Row = {
  id: string; title: string; description: string | null; questions: number; status: string; protection?: 'server' | 'sealed';
  closes_at: string | null; opened_at: string | null; closed_at: string | null; created_at: string;
  vote_count: number; ballot_mode: string; is_quiz: boolean; voted: boolean;
  members_may_vote: boolean; member_votes: number; code_votes: number;
};

// A Society's polls: open ones first. Moderators also see drafts and create polls.
export default function PollList({ societyId }: { societyId: number }) {
  const [data, setData] = useState<{ polls: Row[]; members: number; canCreate: boolean; isMember: boolean } | null>(null);
  const [error, setError] = useState('');
  // Sealed polls' titles are opened here with this person's keys
  const access = useSecureAccess();
  const [keys, setKeys] = useState<Map<string, ItemKeys> | null>(null);
  const anySealed = !!data?.polls.some(p => p.protection === 'sealed');
  useEffect(() => {
    if (!anySealed || access.status !== 'ready' || !access.identity) return;
    listKeys(`/api/societies/${societyId}`, 'poll', access.identity).then(setKeys);
  }, [anySealed, access.status, access.identity, societyId]);
  const titleOf = (p: Row) => p.protection === 'sealed' ? openPayload(keys?.get(p.id) ?? null, p.title)?.title ?? 'Sealed poll' : p.title;
  useEffect(() => {
    fetch(`/api/societies/${societyId}/polls`).then(async r => r.ok ? setData(await r.json()) : setError('Could not load polls.'));
  }, [societyId]);

  if (error) return <p className="text-sm text-rose-300">{error}</p>;
  if (!data) return <div className="h-32 rounded-2xl bg-slate-800/40 animate-pulse" />;
  const groups = [
    { key: 'open', label: 'Open now' },
    { key: 'draft', label: 'Drafts' },
    { key: 'closed', label: 'Closed' },
  ].map(g => ({ ...g, polls: data.polls.filter(p => p.status === g.key) })).filter(g => g.polls.length);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">Polls, ballots and quizzes for this Society’s members. Every ballot is stored encrypted.</p>
        {data.canCreate && <Link href={`/society/${societyId}/polls/new`} className={btnPrimary}>New poll</Link>}
      </div>
      {groups.length === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-dr-card p-10 text-center text-sm text-slate-500">No polls yet.</div>
      )}
      {groups.map(g => (
        <section key={g.key}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600">{g.label}</p>
          <div className="divide-y divide-slate-800/60 overflow-hidden rounded-2xl border border-slate-800 bg-dr-card">
            {g.polls.map(p => (
              <Link key={p.id} href={`/society/${societyId}/polls/${p.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-slate-800/40">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-100">{p.protection === 'sealed' && <span className="mr-1.5" title="Sealed: end-to-end encrypted">🔐</span>}{titleOf(p)}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {p.questions} question{p.questions === 1 ? '' : 's'}
                    {p.is_quiz && ' · quiz'}
                    {p.ballot_mode === 'named' ? ' · named ballot' : ' · secret ballot'}
                    {p.status === 'open' && p.closes_at && ` · closes ${fmtWhen(p.closes_at)}`}
                    {p.status === 'closed' && p.closed_at && ` · closed ${fmtWhen(p.closed_at)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {p.status !== 'draft' && (
                    <span className="tabular-nums text-slate-400">
                      {p.vote_count} voted
                      {p.members_may_vote && data.members ? ` (${Math.min(100, Math.round((p.member_votes / data.members) * 100))}% of members)` : ''}
                      {p.code_votes > 0 && p.members_may_vote ? ` · ${p.code_votes} by code` : ''}
                    </span>
                  )}
                  {p.voted && <span className="text-emerald-400">✓ You voted</span>}
                  {p.status === 'open' && !p.voted && data.isMember && <span className="font-semibold text-blue-300">Vote →</span>}
                  <Badge cls={POLL_STATUS[p.status].cls}>{POLL_STATUS[p.status].label}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
