'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

// "Start your own Society": shown to signed-in members who don't run one yet.
// They can hide it; it stays hidden on this device.
export default function StartSocietyCard({ where, className = '' }: { where: string; className?: string }) {
  const { user } = useAuth();
  const key = 'nv-hide-start-society';
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try { setHidden(localStorage.getItem(key) === '1'); } catch { setHidden(false); }
  }, []);
  if (!user || user.tier === 'moderator' || hidden) return null;
  return (
    <div className={`relative rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 ${className}`} data-where={where}>
      <button onClick={() => { setHidden(true); try { localStorage.setItem(key, '1'); } catch { /* fine */ } }}
        aria-label="Hide" className="absolute right-3 top-2 text-slate-500 hover:text-slate-300">×</button>
      <p className="text-sm font-semibold text-emerald-200">Run a group of your own?</p>
      <p className="mt-1 text-xs text-slate-400">
        Start a Society for your club, team or project: debates, polls, documents, events and calls in one place, private if you like.
        Pod is free, for up to 3 Societies; no approval needed.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <Link href="/dashboard/societies" className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-500">Start a Society</Link>
        <Link href="/pricing" className="text-blue-400 hover:underline">See the plans</Link>
      </div>
    </div>
  );
}
