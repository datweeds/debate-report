'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type LastStatement = {
  id: string;
  stat_title: string;
  subject_area: string;
};

export default function LastStatementPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [statement, setStatement] = useState<LastStatement | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login?next=/dashboard/last-statement');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/user/last-statement')
      .then(r => r.ok ? r.json() : null)
      .then(d => { setStatement(d); setFetching(false); })
      .catch(() => setFetching(false));
  }, [user]);

  if (loading || !user) return null;

  return (
    <div className="px-8 py-10 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Last Statement</h1>
        <p className="text-sm text-slate-500 mt-1">Jump back to the last debate you were viewing</p>
      </div>

      {fetching ? (
        <div className="text-sm text-slate-600 py-8">Loading…</div>
      ) : statement ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-6">
          <p className="text-xs text-slate-600 uppercase tracking-wider mb-1">{statement.subject_area}</p>
          <p className="text-base font-semibold text-slate-100 mb-4 leading-snug">{statement.stat_title}</p>
          <Link
            href={`/chamber?resolution=${statement.id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            Open in Chamber
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-10 text-center">
          <p className="text-sm text-slate-400 font-medium">No recent statement</p>
          <p className="text-xs text-slate-600 mt-1 mb-4">Visit the Chamber to start exploring debates</p>
          <Link
            href="/chamber"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Go to Chamber →
          </Link>
        </div>
      )}
    </div>
  );
}
