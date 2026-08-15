'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DrLogo } from '@/components/DrLogo';

type InviteDetail = {
  id: string;
  forum_id: string;
  forum_title: string;
  forum_description: string | null;
  forum_visibility: string;
  owner_handle: string;
  owner_name: string | null;
  invitation_message: string | null;
};

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router    = useRouter();

  const [detail,   setDetail]   = useState<InviteDetail | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [declining, setDeclining] = useState(false);
  const [declined,  setDeclined]  = useState(false);

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setDetail(d);
      })
      .catch(() => setError('Could not load invitation'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleDecline() {
    setDeclining(true);
    await fetch(`/api/invite/${token}`, { method: 'POST' });
    setDeclined(true);
    setDeclining(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080d1a] flex items-center justify-center">
        <p className="text-slate-500 text-sm">Loading invitation…</p>
      </div>
    );
  }

  if (declined) {
    return (
      <div className="min-h-screen bg-[#080d1a] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <p className="text-slate-300 font-semibold mb-2">Invitation declined</p>
          <p className="text-slate-500 text-sm mb-6">You have declined this invitation.</p>
          <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm">Go to debate.report →</Link>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-[#080d1a] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <p className="text-rose-400 font-semibold mb-2">Invitation unavailable</p>
          <p className="text-slate-500 text-sm mb-6">{error || 'This invitation could not be found.'}</p>
          <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm">Go to debate.report →</Link>
        </div>
      </div>
    );
  }

  const ownerDisplay = detail.owner_name
    ? `${detail.owner_name} (@${detail.owner_handle})`
    : `@${detail.owner_handle}`;

  return (
    <div className="min-h-screen bg-[#080d1a] flex flex-col items-center justify-center px-4 py-16">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 mb-10 select-none">
        <DrLogo className="w-8 h-8" />
        <span className="font-bold text-lg text-slate-100 tracking-tight">
          debate<span className="text-blue-400">.report</span>
        </span>
      </Link>

      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0c1322] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-1">Private Forum Invitation</p>
          <h1 className="text-xl font-bold text-slate-100">{detail.forum_title}</h1>
          {detail.forum_description && (
            <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">{detail.forum_description}</p>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-500/15 flex items-center justify-center">
              <svg className="h-4 w-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12Zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8Z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-500">Invited by</p>
              <p className="text-sm font-semibold text-slate-200">{ownerDisplay}</p>
            </div>
          </div>

          {detail.invitation_message && (
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 px-4 py-3">
              <p className="text-xs font-semibold text-slate-500 mb-1">Message</p>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {detail.invitation_message}
              </p>
            </div>
          )}

          <p className="text-xs text-slate-500 leading-relaxed">
            Accepting this invitation will create a debate.report account and add you as a member of this private forum.
            You can choose to join this forum only (free) or upgrade to participate in all public debates.
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 py-5 border-t border-slate-800 flex flex-col gap-3">
          <Link
            href={`/register?invite=${token}&forum=${encodeURIComponent(detail.forum_title)}&tier=debater`}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white text-center hover:bg-blue-500 transition-colors"
          >
            Accept invitation
          </Link>
          <button
            onClick={handleDecline}
            disabled={declining}
            className="w-full rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors disabled:opacity-50"
          >
            {declining ? 'Declining…' : 'Decline invitation'}
          </button>
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-600">
        Already have an account?{' '}
        <Link
          href={`/login?next=/invite/${token}/join`}
          className="text-blue-500 hover:text-blue-400"
        >
          Log in to accept
        </Link>
      </p>
    </div>
  );
}
