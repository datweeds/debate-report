'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Vote = {
  id: string;
  vote: 'agree' | 'disagree';
  impact: number | null;
  rationale: string | null;
  updated_at: string;
  statement_id: string;
  stat_title: string;
  stat_type: string;
  stat_direction: string | null;
  forum_title: string | null;
  resolution_title: string;
  resolution_id: string;
  author_handle: string | null;
};

const DIRECTION_LABEL: Record<string, string> = {
  for: 'For', against: 'Against', neutral: 'Neutral',
};

const TYPE_LABEL: Record<string, string> = {
  resolution: 'Resolution', argument: 'Argument', evidence: 'Evidence',
  question: 'Question', proposal: 'Proposal',
};

const IMPACT_LABELS: Record<number, string> = {
  1: 'Negligible', 2: 'Negligible', 3: 'Low',
  4: 'Low',        5: 'Medium',     6: 'Medium',
  7: 'High',       8: 'High',       9: 'Critical',
  10: 'Critical',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function YourVotesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [votes, setVotes]   = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login?next=/dashboard/your-votes');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/user/votes')
      .then(r => r.json())
      .then(d => { setVotes(d.votes ?? []); setLoading(false); })
      .catch(() => { setError('Could not load votes'); setLoading(false); });
  }, [user]);

  if (authLoading || !user) return null;

  return (
    <div className="px-4 py-8 sm:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Your Votes</h1>
        <p className="text-sm text-slate-500 mt-1">All statements you have voted on, most recent first</p>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      ) : error ? (
        <div className="py-20 text-center">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : votes.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-10 text-center">
          <svg className="h-10 w-10 mx-auto text-slate-700 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.253m0 0a2.25 2.25 0 0 1-2.25-2.25v-4a2.25 2.25 0 0 1 2.25-2.25h.254" />
          </svg>
          <p className="text-sm text-slate-400 font-medium">No votes yet</p>
          <p className="text-xs text-slate-600 mt-1">Your vote history will appear here once you vote on a statement</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-800/60 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <th className="px-3 py-3 text-left">Forum</th>
                <th className="px-3 py-3 text-left">Resolution</th>
                <th className="px-3 py-3 text-left">Statement</th>
                <th className="px-3 py-3 text-left">Type</th>
                <th className="px-3 py-3 text-left">Direction</th>
                <th className="px-3 py-3 text-left">Author</th>
                <th className="px-3 py-3 text-left">Date</th>
                <th className="px-3 py-3 text-left">Vote</th>
                <th className="px-3 py-3 text-left">Impact</th>
                <th className="px-3 py-3 text-left">Rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {votes.map(v => (
                <tr key={v.id} className="bg-[#0c1322] hover:bg-slate-800/30 transition-colors">
                  <td className="px-3 py-3 text-slate-400 text-xs max-w-[120px] truncate" title={v.forum_title ?? ''}>
                    {v.forum_title ?? <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-3 py-3 text-xs max-w-[160px]">
                    <a
                      href={`/chamber?resolution=${v.resolution_id}`}
                      className="text-blue-400 hover:text-blue-300 leading-snug line-clamp-2 transition-colors"
                    >
                      {v.resolution_title}
                    </a>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-300 max-w-[200px]">
                    <a
                      href={`/chamber?resolution=${v.resolution_id}&statement=${v.statement_id}`}
                      className="leading-snug line-clamp-2 hover:text-white transition-colors"
                    >
                      {v.stat_title}
                    </a>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {TYPE_LABEL[v.stat_type] ?? v.stat_type}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {v.stat_direction ? (
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        v.stat_direction === 'for'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : v.stat_direction === 'against'
                          ? 'bg-rose-500/15 text-rose-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}>
                        {DIRECTION_LABEL[v.stat_direction] ?? v.stat_direction}
                      </span>
                    ) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {v.author_handle ?? <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {fmt(v.updated_at)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      v.vote === 'agree'
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-rose-500/15 text-rose-300'
                    }`}>
                      {v.vote === 'agree' ? (
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      )}
                      {v.vote === 'agree' ? 'Agree' : 'Disagree'}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {v.impact ? (
                      <span className="text-amber-300 font-semibold text-xs">
                        {v.impact}
                        <span className="text-slate-500 font-normal ml-1">/ {IMPACT_LABELS[v.impact]}</span>
                      </span>
                    ) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-400 max-w-[200px]">
                    {v.rationale
                      ? <span className="line-clamp-2 leading-snug" title={v.rationale}>{v.rationale}</span>
                      : <span className="text-slate-600">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
