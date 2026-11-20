'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import AnalyticsView, { type Stats } from '@/components/analytics/AnalyticsView';

// Society Admin analytics: the same view as Admin → Analytics, for the
// Societies this person administers (all of them, or one).
export default function SocietyAnalyticsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [society, setSociety] = useState(0);
  const [data, setData] = useState<(Stats & { societies: { id: number; name: string }[] }) | { societies: [] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { if (!loading && !user) router.push('/login?next=/dashboard/analytics'); }, [loading, user, router]);
  useEffect(() => {
    if (!user) return;
    setData(null); setError('');
    fetch(`/api/manage/analytics${society ? `?society=${society}` : ''}`)
      .then(async r => { if (r.ok) setData(await r.json()); else setError('Couldn’t load the analytics.'); })
      .catch(() => setError('Couldn’t load the analytics.'));
  }, [user, society]);

  if (loading || !user) return null;
  const societies = data?.societies ?? [];
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">Activity in the Societies you administer.</p>
        </div>
        {societies.length > 1 && (
          <select value={society} onChange={e => setSociety(Number(e.target.value))} aria-label="Society"
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200">
            <option value={0}>All my Societies ({societies.length})</option>
            {societies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>
      {error ? <p className="text-sm text-rose-400">{error}</p>
        : !data ? <div className="h-64 animate-pulse rounded-2xl bg-slate-800/40" />
        : !('metrics' in data) ? (
          <div className="rounded-2xl border border-slate-800 bg-dr-card p-10 text-center text-sm text-slate-400">
            You’re not an admin of any Society. <Link href="/dashboard/societies" className="text-blue-400 hover:underline">Manage Societies</Link>
          </div>
        ) : <AnalyticsView stats={data} />}
    </div>
  );
}
