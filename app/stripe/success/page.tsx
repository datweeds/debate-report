'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

// Where Stripe Checkout returns to after paying. The plan itself is switched on
// by Stripe's webhook, usually within a few seconds.
export default function StripeSuccessPage() {
  const { refresh } = useAuth();
  const [next, setNext] = useState('/dashboard/billing');

  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get('next') ?? '';
    if (n.startsWith('/') && !n.startsWith('//') && !n.includes('\\')) setNext(n);
    // Refresh the session so a personal plan shows straight away
    const t = setTimeout(() => { void refresh(); }, 2000);
    return () => clearTimeout(t);
  }, [refresh]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080d1a] px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
          <svg className="h-8 w-8 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="mb-3 text-2xl font-bold text-slate-100">Thank you</h1>
        <p className="mb-8 text-sm leading-relaxed text-slate-400">
          Your payment went through. Your plan switches on within a few seconds, and Stripe emails you a receipt.
        </p>
        <Link href={next} className="inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500">
          Continue
        </Link>
        <p className="mt-8 text-xs text-slate-600">
          Manage or cancel any time in{' '}
          <Link href="/dashboard/billing" className="text-blue-500 hover:text-blue-400">Billing</Link>.
        </p>
      </div>
    </div>
  );
}
