'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

export default function StripeSuccessPage() {
  const { refresh } = useAuth();

  // Refresh session so user.plan reflects the new paid status
  useEffect(() => {
    const t = setTimeout(() => { void refresh(); }, 1500);
    return () => clearTimeout(t);
  }, [refresh]);

  return (
    <div className="min-h-screen bg-[#080d1a] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <svg className="h-8 w-8 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-100 mb-3">Welcome to debate.report Paid</h1>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          Your subscription is active. You now have access to unlimited private forums and public debates.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/chamber"
            className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            Go to the Chamber
          </Link>
          <Link
            href="/dashboard/forums"
            className="rounded-xl border border-slate-700 px-6 py-3 text-sm font-medium text-slate-300 hover:border-slate-600 hover:text-slate-100 transition-colors"
          >
            Manage your forums
          </Link>
        </div>
        <p className="mt-8 text-xs text-slate-600">
          Manage or cancel your subscription any time in{' '}
          <Link href="/dashboard/billing" className="text-blue-500 hover:text-blue-400">
            Billing settings
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
