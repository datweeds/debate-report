'use client';

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import JoinSocietyButton from '@/components/societies/JoinSocietyButton';

// Shown instead of Discussions to people who aren't members of the Society
export default function MembersOnly({ societyId, visibility, pending }: { societyId: number; visibility: string; pending: boolean }) {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-800 bg-dr-card p-6 text-center">
      <p className="text-lg font-semibold text-slate-100">Become a member to view discussions</p>
      <p className="mt-2 text-sm text-slate-400">Discussions are where this Society’s members talk among themselves.</p>
      <div className="mt-4 flex justify-center">
        {!user ? (
          <span className="flex gap-2">
            <Link href={`/login?next=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : `/society/${societyId}/discussions`)}`}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">Log in</Link>
            <Link href="/register" className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">Sign up</Link>
          </span>
        ) : (
          <JoinSocietyButton societyId={societyId} loggedIn pending={pending} instant={visibility === 'public'} />
        )}
      </div>
    </div>
  );
}
