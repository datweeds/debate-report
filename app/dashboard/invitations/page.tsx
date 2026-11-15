'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

type SentInvite = {
  id: string;
  resolution_id: string;
  debate_title: string;
  society_name: string | null;
  invitee_user_id: string;
  user_handle: string;
  user_full_name: string | null;
  status: string;
  message: string | null;
  created_at: string;
};

type ReceivedInvite = {
  id: string;
  resolution_id: string;
  debate_title: string;
  status: string;
  message: string | null;
  created_at: string;
  inviter_handle: string | null;
};

const STATUS_COLOUR: Record<string, string> = {
  pending:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  accepted: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  declined: 'bg-slate-700 text-slate-500 border-slate-600',
};

export default function InvitationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [sent,     setSent]     = useState<SentInvite[]>([]);
  const [received, setReceived] = useState<ReceivedInvite[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error,    setError]    = useState('');
  const [acting,   setActing]   = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login?next=/dashboard/invitations');
  }, [loading, user, router]);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/dashboard/invitations');
      if (!res.ok) throw new Error();
      const d = await res.json();
      setSent(d.sent ?? []);
      setReceived(d.received ?? []);
    } catch {
      setError('Could not load invitations');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  async function respond(inv: ReceivedInvite, action: 'accept' | 'decline') {
    setActing(inv.id);
    try {
      const res = await fetch(`/api/debates/${inv.resolution_id}/invite/${inv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setReceived(prev => prev.map(r => r.id === inv.id ? { ...r, status: action === 'accept' ? 'accepted' : 'declined' } : r));
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

  const pendingReceived = received.filter(r => r.status === 'pending');
  const resolvedReceived = received.filter(r => r.status !== 'pending');

  return (
    <div className="px-6 py-8 max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Invitations</h1>
        <p className="text-sm text-slate-500 mt-1">
          Invitations to Invite-visibility debates — yours to respond to, and (for Society Admins) ones you&apos;ve sent.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {fetching ? (
        <div className="py-16 text-center text-slate-500 text-sm">Loading…</div>
      ) : (
        <>
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
              Invited to you
              {pendingReceived.length > 0 && (
                <span className="ml-1 rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-300">
                  {pendingReceived.length}
                </span>
              )}
            </h2>
            {received.length === 0 ? (
              <p className="text-sm text-slate-600 italic">No invitations.</p>
            ) : (
              <div className="space-y-3">
                {[...pendingReceived, ...resolvedReceived].map(inv => (
                  <div key={inv.id} className="rounded-2xl border border-slate-800 bg-[#0c1322] p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate">{inv.debate_title}</p>
                        {inv.inviter_handle && <p className="text-xs text-slate-500 mt-0.5">Invited by @{inv.inviter_handle}</p>}
                        {inv.message && <p className="text-xs text-slate-500 mt-1 italic">&ldquo;{inv.message}&rdquo;</p>}
                      </div>
                      <span className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wider border rounded px-1.5 py-0.5 ${STATUS_COLOUR[inv.status]}`}>
                        {inv.status}
                      </span>
                    </div>
                    {inv.status === 'pending' && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => respond(inv, 'accept')}
                          disabled={acting === inv.id}
                          className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                        >
                          {acting === inv.id ? '…' : 'Accept'}
                        </button>
                        <button
                          onClick={() => respond(inv, 'decline')}
                          disabled={acting === inv.id}
                          className="rounded-lg border border-slate-700 px-4 py-1.5 text-sm text-slate-400 hover:text-slate-200 hover:border-slate-600 disabled:opacity-50 transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {sent.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Sent (your Societies)</h2>
              <div className="space-y-3">
                {sent.map(inv => (
                  <div key={inv.id} className="rounded-2xl border border-slate-800 bg-[#0c1322] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate">
                          @{inv.user_handle} <span className="text-slate-500 font-normal">→ {inv.debate_title}</span>
                        </p>
                        {inv.society_name && <p className="text-xs text-slate-500 mt-0.5">{inv.society_name}</p>}
                      </div>
                      <span className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wider border rounded px-1.5 py-0.5 ${STATUS_COLOUR[inv.status]}`}>
                        {inv.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
