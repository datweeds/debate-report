'use client';

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

// Pricing page buttons, which depend on who is looking. New Societies are
// started straight away by anyone with an account: no approval.
export default function PricingActions({ kind, onSale }: { kind: 'free' | 'society' | 'society_plus'; onSale: boolean }) {
  const { user } = useAuth();
  const btn = 'mt-6 inline-block w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors';
  const style = kind === 'free' ? 'bg-blue-600 text-white hover:bg-blue-500' : kind === 'society' ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-amber-600 text-white hover:bg-amber-500';

  if (kind !== 'free') {
    if (!onSale) return <p className="mt-6 rounded-lg border border-slate-700 px-4 py-2.5 text-center text-sm text-slate-400">On sale soon</p>;
    if (user) return <Link href="/dashboard/billing" className={`${btn} ${style}`}>Choose this plan</Link>;
    return <Link href={user ? '/profile' : '/register'} className={`${btn} ${style}`}>Start with Free, upgrade any time</Link>;
  }
  if (!user) return <><Link href="/register" className={`${btn} ${style}`}>Sign up free</Link><p className="mt-2 text-center text-xs text-slate-500">Start a Society straight away: no approval needed.</p></>;
  if (user.tier === 'moderator') return <Link href="/dashboard/societies" className={`${btn} border border-blue-500/40 text-blue-300 hover:bg-blue-500/10`}>Manage your Societies</Link>;
  return <><Link href="/dashboard/societies" className={`${btn} ${style}`}>Start a Society</Link><p className="mt-2 text-center text-xs text-slate-500">Start a Society straight away: no approval needed.</p></>;
}
