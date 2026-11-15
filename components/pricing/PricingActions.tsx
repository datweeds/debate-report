'use client';

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

// Pricing page buttons, which depend on who is looking.
export default function PricingActions({ kind }: { kind: 'free' | 'moderator' }) {
  const { user } = useAuth();
  const btn = 'mt-6 inline-block w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors';

  if (kind === 'free') {
    return user
      ? <p className="mt-6 text-center text-sm text-slate-500">You&apos;re signed up.</p>
      : <Link href="/register" className={`${btn} bg-blue-600 text-white hover:bg-blue-500`}>Sign up free</Link>;
  }
  if (!user) {
    return <Link href="/register" className={`${btn} bg-emerald-600 text-white hover:bg-emerald-500`}>Sign up, then request Moderator</Link>;
  }
  if (user.tier === 'moderator') {
    return <Link href="/dashboard/societies" className={`${btn} border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10`}>You&apos;re a Moderator: manage your Societies</Link>;
  }
  return <Link href="/profile" className={`${btn} bg-emerald-600 text-white hover:bg-emerald-500`}>Request Moderator access</Link>;
}
