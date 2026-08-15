'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

type JoinRequest = {
  id: string;
  forum_id: string;
  forum_title: string;
  user_id: string;
  user_handle: string;
  user_name: string | null;
  join_message: string | null;
  join_status: string;
  created_at: string;
};

export default function JoinRequestsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [requests,  setRequests]  = useState<JoinRequest[]>([]);
  const [fetching,  setFetching]  = useState(true);
  const [error,     setError]     = useState('');
  const [acting,    setActing]    = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login?next=/dashboard/join-requests');
    if (!loading && user && user.tier === 'follower') router.push('/dashboard');
  }, [loading, user, router]);

  const loadRequests = useCallback(async () => {
    setFetching(true);
    try {
      const forumsRes = await fetch('/api/forums');
      if (!forumsRes.ok) throw new Error();
      const forums: { id: string; forum_title: string }[] = await forumsRes.json();

      const all: JoinRequest[] = [];
      await Promise.all(
        forums.map(async f => {
          const res = await fetch(`/api/forums/${f.id}/join-requests`);
          if (!res.ok) return;
          const rows: Omit<JoinRequest, 'forum_title'>[] = await res.json();
          rows.forEach(r => all.push({ ...r, forum_title: f.forum_title }));
        })
      );
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRequests(all);
    } catch {
      setError('Could not load join requests');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { if (user) loadRequests(); }, [user, loadRequests]);

  async function handleAction(req: JoinRequest, action: 'accept' | 'deny') {
    setActing(req.id);
    try {
      const res = await fetch(`/api/forums/${req.forum_id}/join-requests/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setRequests(prev =>
          prev.map(r =>
            r.id === req.id
              ? { ...r, join_status: action === 'accept' ? 'accepted' : 'denied' }
              : r
          )
        );
      } else {
        const d = await res.json();
        setError(d.error ?? 'Action failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setActing(null);
    }
  }

  if (loading || !user) return null;

  const pending  = requests.filter(r => r.join_status === 'pending');
  const resolved = requests.filter(r => r.join_status !== 'pending');

  return (
    <div className="px-6 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Join Requests</h1>
        <p className="text-sm text-slate-500 mt-1">
          Applications to join your Apply-type private forums.
        </p>
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {fetching ? (
        <div className="py-16 text-center text-slate-500 text-sm">Loading…</div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-10 text-center">
          <svg className="h-10 w-10 mx-auto text-slate-700 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
          </svg>
          <p className="text-sm text-slate-400 font-medium">No pending requests</p>
          <p className="text-xs text-slate-600 mt-1">
            Join requests from users who find your Apply-type forums will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {pending.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
                Pending{' '}
                <span className="ml-1 rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-300">
                  {pending.length}
                </span>
              </h2>
              <div className="space-y-3">
                {pending.map(req => (
                  <RequestCard
                    key={req.id}
                    req={req}
                    onAccept={() => handleAction(req, 'accept')}
                    onDeny={() => handleAction(req, 'deny')}
                    acting={acting === req.id}
                  />
                ))}
              </div>
            </section>
          )}

          {resolved.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Resolved</h2>
              <div className="space-y-3">
                {resolved.map(req => (
                  <RequestCard
                    key={req.id}
                    req={req}
                    onAccept={() => {}}
                    onDeny={() => {}}
                    acting={false}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function RequestCard({
  req, onAccept, onDeny, acting,
}: {
  req: JoinRequest;
  onAccept: () => void;
  onDeny: () => void;
  acting: boolean;
}) {
  const isPending = req.join_status === 'pending';
  const statusColour = req.join_status === 'accepted'
    ? 'text-emerald-400'
    : req.join_status === 'denied'
    ? 'text-slate-500'
    : 'text-amber-400';

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-100">
              @{req.user_handle}
              {req.user_name && <span className="text-slate-500 font-normal ml-1">({req.user_name})</span>}
            </p>
            <span className="text-xs text-slate-600">→ {req.forum_title}</span>
          </div>
          {req.join_message && (
            <p className="text-xs text-slate-400 mt-1.5 italic">&ldquo;{req.join_message}&rdquo;</p>
          )}
          <p className="text-xs text-slate-600 mt-1.5">
            {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        {!isPending && (
          <span className={`text-xs font-semibold capitalize flex-shrink-0 ${statusColour}`}>
            {req.join_status}
          </span>
        )}
      </div>

      {isPending && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={onAccept}
            disabled={acting}
            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {acting ? '…' : 'Accept'}
          </button>
          <button
            onClick={onDeny}
            disabled={acting}
            className="rounded-lg border border-slate-700 px-4 py-1.5 text-sm text-slate-400 hover:text-slate-200 hover:border-slate-600 disabled:opacity-50 transition-colors"
          >
            Deny
          </button>
        </div>
      )}
    </div>
  );
}
