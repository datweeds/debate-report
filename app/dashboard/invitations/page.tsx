'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

type Invitation = {
  id: string;
  forum_id: string;
  forum_title: string;
  invitee_email: string | null;
  invitation_message: string | null;
  invitation_status: string;
  created_at: string;
  url: string;
};

const STATUS_COLOUR: Record<string, string> = {
  open:     'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  accepted: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  rejected: 'bg-slate-700 text-slate-500 border-slate-600',
  expired:  'bg-slate-700 text-slate-500 border-slate-600',
  paused:   'bg-amber-500/15 text-amber-300 border-amber-500/30',
};

export default function InvitationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [fetching,    setFetching]    = useState(true);
  const [error,       setError]       = useState('');
  const [copiedId,    setCopiedId]    = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login?next=/dashboard/invitations');
    if (!loading && user && user.tier === 'follower') router.push('/dashboard');
  }, [loading, user, router]);

  const loadInvitations = useCallback(async () => {
    setFetching(true);
    try {
      const forumsRes = await fetch('/api/forums');
      if (!forumsRes.ok) throw new Error();
      const forums: { id: string; forum_title: string }[] = await forumsRes.json();

      const all: Invitation[] = [];
      await Promise.all(
        forums.map(async f => {
          const res = await fetch(`/api/forums/${f.id}/invite`);
          if (!res.ok) return;
          const rows: Omit<Invitation, 'forum_title'>[] = await res.json();
          rows.forEach(r => all.push({ ...r, forum_title: f.forum_title }));
        })
      );
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setInvitations(all);
    } catch {
      setError('Could not load invitations');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { if (user) loadInvitations(); }, [user, loadInvitations]);

  function copyLink(inv: Invitation) {
    navigator.clipboard.writeText(inv.url).then(() => {
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  if (loading || !user) return null;

  const openInvites   = invitations.filter(i => i.invitation_status === 'open');
  const closedInvites = invitations.filter(i => i.invitation_status !== 'open');

  return (
    <div className="px-6 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Invitations</h1>
        <p className="text-sm text-slate-500 mt-1">
          Magic links you&apos;ve generated for your private forums. Go to{' '}
          <a href="/dashboard/forums" className="text-blue-400 hover:text-blue-300">Forums</a> to create new ones.
        </p>
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {fetching ? (
        <div className="py-16 text-center text-slate-500 text-sm">Loading…</div>
      ) : invitations.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-10 text-center">
          <svg className="h-10 w-10 mx-auto text-slate-700 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
          </svg>
          <p className="text-sm text-slate-400 font-medium">No invitations yet</p>
          <p className="text-xs text-slate-600 mt-1">
            Generate a magic link from the{' '}
            <a href="/dashboard/forums" className="text-blue-500 hover:text-blue-400">Forums</a> page.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {openInvites.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Open</h2>
              <div className="space-y-3">
                {openInvites.map(inv => (
                  <InvitationRow key={inv.id} inv={inv} copied={copiedId === inv.id} onCopy={() => copyLink(inv)} />
                ))}
              </div>
            </section>
          )}

          {closedInvites.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">History</h2>
              <div className="space-y-3">
                {closedInvites.map(inv => (
                  <InvitationRow key={inv.id} inv={inv} copied={copiedId === inv.id} onCopy={() => copyLink(inv)} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function InvitationRow({ inv, copied, onCopy }: { inv: Invitation; copied: boolean; onCopy: () => void }) {
  const isOpen = inv.invitation_status === 'open';

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-200 truncate">{inv.forum_title}</p>
          {inv.invitee_email && (
            <p className="text-xs text-slate-500 mt-0.5">{inv.invitee_email}</p>
          )}
          {inv.invitation_message && (
            <p className="text-xs text-slate-500 mt-1 italic line-clamp-2">&ldquo;{inv.invitation_message}&rdquo;</p>
          )}
        </div>
        <span className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wider border rounded px-1.5 py-0.5 ${STATUS_COLOUR[inv.invitation_status] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
          {inv.invitation_status}
        </span>
      </div>

      {isOpen ? (
        <button
          onClick={onCopy}
          className="w-full flex items-center gap-3 rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 hover:border-violet-500/40 transition-colors group text-left"
        >
          <span className="flex-1 font-mono text-xs text-violet-300 truncate">{inv.url}</span>
          <span className={`flex-shrink-0 text-xs transition-colors ${copied ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
            {copied ? 'Copied!' : 'Copy'}
          </span>
        </button>
      ) : (
        <p className="text-xs text-slate-600">
          {new Date(inv.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}
    </div>
  );
}
