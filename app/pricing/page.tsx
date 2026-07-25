'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

const TIERS = [
  {
    id: 'follower',
    name: 'Follower',
    monthly: 0,
    annual: 0,
    color: 'slate',
    gradient: 'text-slate-300',
    border: 'border-slate-700',
    badge: 'bg-slate-700/50 text-slate-400 border-slate-600',
    btn: 'border border-slate-600 text-slate-300 hover:border-slate-500 hover:bg-white/5',
    btnStyle: 'outline' as const,
    features: [
      'Browse all public debates',
      'Read statements and evidence',
      'Follow debate outcomes',
      'No participation',
    ],
    note: 'Always free — no card required',
  },
  {
    id: 'voter',
    name: 'Voter',
    monthly: 2,
    annual: 1.50,
    color: 'emerald',
    gradient: 'text-gradient-emerald',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    btn: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    btnStyle: 'solid' as const,
    features: [
      'Everything in Follower',
      'Vote on any public debate',
      'Rate statement impact',
      'Chat on debate statements',
    ],
    note: 'Great for following issues you care about',
  },
  {
    id: 'debater',
    name: 'Debater',
    monthly: 4,
    annual: 3,
    color: 'blue',
    gradient: 'text-gradient-blue',
    border: 'border-blue-500/40',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    btn: 'bg-blue-600 hover:bg-blue-500 text-white',
    btnStyle: 'solid' as const,
    features: [
      'Everything in Voter',
      'Submit claims and evidence',
      'Write rebuttals',
      'Participate in unlimited debates',
    ],
    note: 'For those who want to argue a case',
    highlight: true,
  },
  {
    id: 'moderator',
    name: 'Moderator',
    monthly: 9,
    annual: 6.75,
    color: 'amber',
    gradient: 'text-gradient-gold',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    btn: 'bg-amber-600 hover:bg-amber-500 text-white',
    btnStyle: 'solid' as const,
    features: [
      'Everything in Debater',
      'Create and moderate debates',
      'Invite participants',
      '5 family Voter seats included',
    ],
    note: 'For educators, journalists, organisations',
  },
];

export default function PricingPage() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  async function subscribe(tierId: string) {
    if (!user) {
      router.push(`/register?tier=${tierId}`);
      return;
    }
    setLoading(tierId);
    try {
      await fetch('/api/user/tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: tierId }),
      });
      await refresh();
      router.push('/');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-dr-base py-16 px-4 sm:px-6">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-700/30 bg-blue-500/10 px-4 py-1.5 text-xs font-medium text-blue-300 tracking-wide uppercase">
            Simple, transparent pricing
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-50 mb-4">
            Choose how you engage
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto mb-6">
            Follow debates for free. Pay only when you want to participate.
            No payment required right now — select your tier and we&apos;ll collect details when billing goes live.
          </p>

          {/* Monthly / Annual toggle */}
          <div className="inline-flex items-center gap-3 rounded-xl border border-slate-700 bg-dr-card p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${!annual ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${annual ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Annual
              <span className="ml-1.5 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-xs text-emerald-400">
                −25%
              </span>
            </button>
          </div>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {TIERS.map(tier => {
            const price = annual ? tier.annual : tier.monthly;
            const isCurrent = user?.tier === tier.id;

            return (
              <div
                key={tier.id}
                className={`card-dr relative flex flex-col p-5 ${tier.highlight ? 'border-blue-500/40 shadow-lg shadow-blue-500/10' : tier.border}`}
              >
                {tier.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white">
                      Most popular
                    </span>
                  </div>
                )}

                <div className={`inline-flex self-start items-center rounded-full border px-2.5 py-0.5 text-xs font-medium mb-3 ${tier.badge}`}>
                  {tier.name}
                </div>

                <div className="mb-1">
                  {price === 0 ? (
                    <span className={`text-3xl font-extrabold ${tier.gradient}`}>Free</span>
                  ) : (
                    <>
                      <span className={`text-3xl font-extrabold ${tier.gradient}`}>
                        £{price.toFixed(2)}
                      </span>
                      <span className="text-slate-500 text-xs ml-1">/mo</span>
                    </>
                  )}
                </div>
                {annual && price > 0 && (
                  <p className="text-xs text-emerald-400 mb-1">
                    £{(price * 12).toFixed(2)} billed annually
                  </p>
                )}
                <p className="text-xs text-slate-600 mb-4">{tier.note}</p>

                <ul className="space-y-2 mb-5 flex-1">
                  {tier.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-400">
                      <svg className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-center text-sm font-medium text-emerald-400">
                    Current plan
                  </div>
                ) : (
                  <button
                    onClick={() => subscribe(tier.id)}
                    disabled={loading === tier.id}
                    className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-center transition-colors disabled:opacity-50 ${tier.btn}`}
                  >
                    {loading === tier.id ? 'Updating…' : tier.id === 'follower' ? 'Get started free' : 'Select plan'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Incognito note */}
        <div className="card-dr p-5 flex flex-col sm:flex-row items-center gap-4 justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-200 mb-0.5">Prefer to stay anonymous?</h2>
            <p className="text-xs text-slate-500">
              All paid tiers support incognito registration — choose a username, skip the email,
              and we generate a private access code. No personal data stored.
            </p>
          </div>
          <Link
            href="/register?incognito=true"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-4 py-2 text-xs font-medium text-slate-300 hover:border-slate-500 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 0 1 21.75 8.25Z" />
            </svg>
            Register incognito
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          Payment is not collected yet — select your plan now and billing activates when Stripe is live.
        </p>

      </div>
    </div>
  );
}
