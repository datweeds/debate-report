'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function BillingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login?next=/dashboard/billing');
  }, [loading, user, router]);

  async function openPortal() {
    setRedirecting(true); setError('');
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Could not open billing portal'); return; }
      window.location.href = data.url;
    } catch {
      setError('Network error — please try again');
      setRedirecting(false);
    }
  }

  if (loading || !user) return null;

  const isPaid = user.plan === 'paid';

  return (
    <div className="px-6 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Billing</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your subscription and payment details.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Current plan</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-slate-100">
                {isPaid ? 'Paid' : 'Free'}
              </span>
              <span className={`text-xs font-bold uppercase tracking-wider rounded px-1.5 py-0.5 border ${
                isPaid
                  ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                  : 'bg-slate-700 text-slate-400 border-slate-600'
              }`}>
                {isPaid ? 'Active' : 'Free tier'}
              </span>
            </div>
          </div>
          <div className="text-right">
            {isPaid ? (
              <p className="text-sm text-slate-400">£4/month or £36/year</p>
            ) : (
              <Link
                href="/pricing"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
              >
                Upgrade to Paid
              </Link>
            )}
          </div>
        </div>

        {isPaid ? (
          <>
            <p className="text-sm text-slate-400 mb-5">
              Your subscription gives you unlimited private forums and full access to public debates.
              Manage or cancel through the Stripe billing portal.
            </p>
            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
            <button
              onClick={openPortal}
              disabled={redirecting}
              className="rounded-xl bg-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-600 disabled:opacity-50 transition-colors"
            >
              {redirecting ? 'Opening portal…' : 'Manage subscription'}
            </button>
          </>
        ) : (
          <div className="space-y-3 text-sm text-slate-400">
            <p>You&apos;re on the free tier — all core features are included.</p>
            <p>
              Upgrade to Paid (£4/month or £36/year) for unlimited private forums and public debate access.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
