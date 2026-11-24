'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';

// "Please confirm your age", when an age check is due for this member.
export default function AgeCheckBanner() {
  const { user } = useAuth();
  const path = usePathname();
  const [due, setDue] = useState(false);
  useEffect(() => {
    if (!user) { setDue(false); return; }
    fetch('/api/age-check').then(r => r.ok ? r.json() : null).then(d => setDue(!!d?.due)).catch(() => {});
  }, [user, path]);
  if (!due || path === '/age-check') return null;
  return (
    <div className="mx-auto mt-2 max-w-5xl px-4">
      <p className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
        <span className="flex-1">Please confirm your age. It takes a minute, and we learn only your age group.</span>
        <Link href="/age-check" className="rounded-md border border-amber-400/50 px-2 py-0.5 font-semibold hover:bg-amber-500/20">Confirm my age</Link>
      </p>
    </div>
  );
}
