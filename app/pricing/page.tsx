'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

// ── Feature data ─────────────────────────────────────────────────────────────

const SHARED_FEATURES = [
  'Learn to debate with the Guide',
  'View all public debates',
  'Private debates with up to 6 people in a private forum',
  'Visual graph of the debate',
  'Running live metrics on which side is winning',
  'Anonymous or Public Persona',
  'Automated moderation for profanity, hate, personal data',
  'Chat with other debaters',
  'Vote on debates',
];

const FREE_ONLY = [
  'Unlimited debates in a single private forum',
];

const PAID_ONLY = [
  'Participate in public debates',
  'Unlimited private forums',
  'Unlimited debaters in private forums',
  'AI Assistant — structured argument generation and debate analysis',
];

// ── Small icon helpers ────────────────────────────────────────────────────────

function Check({ className = 'text-emerald-400' }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 flex-shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

function Dash() {
  return (
    <svg className="h-4 w-4 flex-shrink-0 text-slate-700" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
    </svg>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const { user } = useAuth();
  const router   = useRouter();
  const [annual,      setAnnual]      = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [showPasskey, setShowPasskey] = useState(false);

  const isPaid = user?.plan === 'paid';

  async function handleUpgrade() {
    if (!user) {
      router.push('/register?tier=debater');
      return;
    }
    if (isPaid) {
      router.push('/dashboard/billing');
      return;
    }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/stripe/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ billing: annual ? 'annual' : 'monthly' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Could not start checkout'); return; }
      window.location.href = data.url;
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  const monthlyPrice = annual ? 3.00 : 4.00;

  return (
    <div className="min-h-screen bg-dr-base py-16 px-4">
      {showPasskey && <PasskeyModal onClose={() => setShowPasskey(false)} />}

      <div className="mx-auto max-w-5xl">

        {/* Page header */}
        <div className="text-center mb-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-700/30 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-300 tracking-widest uppercase">
            Pricing
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-50 mb-4">
            Structured debate, for everyone
          </h1>
          <p className="text-slate-400 max-w-lg mx-auto">
            Start free and upgrade only when you need more. No credit card required to get started.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-[#0c1322] p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${
                !annual ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${
                annual ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Annual
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                annual ? 'bg-white/20 text-white' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                −25%
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">

          {/* Free card */}
          <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-7 flex flex-col">
            <div className="mb-5">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Free</span>
              <div className="mt-2 flex items-end gap-1">
                <span className="text-4xl font-extrabold text-slate-100">£0</span>
                <span className="text-slate-500 mb-1 text-sm">/month</span>
              </div>
              <p className="text-xs text-slate-600 mt-1">Always free — no card required</p>
            </div>

            {user && !isPaid ? (
              <div className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-center text-sm font-semibold text-emerald-400 mb-6">
                Your current plan
              </div>
            ) : (
              <Link
                href={user ? '/dashboard' : '/register?tier=debater'}
                className="w-full rounded-xl border border-slate-600 bg-slate-700/60 px-4 py-2.5 text-sm font-semibold text-slate-100 text-center hover:bg-slate-600/70 hover:border-slate-500 transition-colors mb-6"
              >
                {user ? 'Go to dashboard' : 'Get started free'}
              </Link>
            )}

            <div className="space-y-3 flex-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">What&apos;s included</p>
              {SHARED_FEATURES.map(f => (
                <div key={f} className="flex items-start gap-2.5">
                  <Check />
                  <span className="text-sm text-slate-400">{f}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-800/80">
                {FREE_ONLY.map(f => (
                  <div key={f} className="flex items-start gap-2.5 mt-3">
                    <Check />
                    <span className="text-sm text-slate-400">{f}</span>
                  </div>
                ))}
                {PAID_ONLY.map(f => (
                  <div key={f} className="flex items-start gap-2.5 mt-3 opacity-60">
                    <Dash />
                    <span className="text-sm text-slate-400 line-through decoration-slate-500">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Paid card */}
          <div className="rounded-2xl border border-blue-500/40 bg-[#0c1322] p-7 flex flex-col relative shadow-xl shadow-blue-500/5">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold text-white tracking-wide">
                Paid
              </span>
            </div>

            <div className="mb-5">
              <span className="text-xs font-bold uppercase tracking-widest text-blue-400">Debater</span>
              <div className="mt-2 flex items-end gap-1">
                <span className="text-4xl font-extrabold text-slate-100">
                  £{monthlyPrice.toFixed(2)}
                </span>
                <span className="text-slate-500 mb-1 text-sm">/month</span>
              </div>
              {annual ? (
                <p className="text-xs text-emerald-400 mt-1">£36 billed annually — save £12</p>
              ) : (
                <p className="text-xs text-slate-600 mt-1">or £36/year (save 25%)</p>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">
                {error}
              </p>
            )}

            {isPaid ? (
              <Link
                href="/dashboard/billing"
                className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-400 text-center hover:bg-emerald-500/15 transition-colors mb-6"
              >
                Manage subscription
              </Link>
            ) : (
              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors mb-6"
              >
                {loading ? 'Redirecting to checkout…' : user ? 'Upgrade now' : 'Start with Paid'}
              </button>
            )}

            <div className="space-y-3 flex-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Everything in Free, plus</p>
              {PAID_ONLY.map(f => (
                <div key={f} className="flex items-start gap-2.5">
                  <Check className="text-blue-400" />
                  <span className="text-sm text-slate-300 font-medium">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Privacy + trust section */}
        <div className="card-dr p-6">
          <div className="grid sm:grid-cols-3 gap-6 text-xs text-slate-400">
            <div>
              <p className="font-semibold text-slate-200 mb-1.5">Privacy by design</p>
              <p>
                Your email is optional and only used for the newsletter. We collect as little as possible —
                your handle is all we need.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-200 mb-1.5">Passkeys, not passwords</p>
              <p>
                We use your device&apos;s biometrics (Face ID, fingerprint, Windows Hello) — no password
                database to breach. Your private key never leaves your device.{' '}
                <button
                  onClick={() => setShowPasskey(true)}
                  className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
                >
                  Learn more
                </button>
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-200 mb-1.5">Secure payments</p>
              <p>
                Payments are handled by <strong className="text-slate-300">Stripe</strong> — your card details
                never touch our servers. Cancel any time from your{' '}
                <Link href="/dashboard/billing" className="text-blue-400 hover:text-blue-300">
                  billing dashboard
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Passkey info modal ────────────────────────────────────────────────────────

function PasskeyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card-dr w-full max-w-lg p-7 relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="flex items-center gap-3 mb-5">
          <div className="rounded-full bg-blue-500/10 p-2">
            <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 0 1 21.75 8.25Z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-slate-100">About passkeys</h2>
        </div>
        <div className="space-y-4 text-sm text-slate-400">
          <div>
            <p className="font-medium text-slate-200 mb-1">What is a passkey?</p>
            <p>A passkey uses your device&apos;s built-in security chip — the same technology behind Face ID, Touch ID, and Windows Hello — to prove it&apos;s you. Your private key is created on your device and never sent anywhere.</p>
          </div>
          <div>
            <p className="font-medium text-slate-200 mb-1">Why passkeys are stronger than passwords</p>
            <ul className="space-y-1.5">
              {[
                ['Phishing-proof.', 'A passkey is cryptographically bound to this exact domain. Even a perfect fake login page cannot capture it.'],
                ['No password database.', 'If our servers were ever compromised, there are no password hashes to crack.'],
                ['No reuse risk.', 'Passkeys are unique per site by design, so a breach elsewhere cannot affect your account here.'],
              ].map(([b, t]) => (
                <li key={b} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                  <span><strong className="text-slate-300">{b}</strong> {t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-slate-200 mb-1">Recovery code</p>
            <p>We generate a one-time recovery code at signup shown only once. Store it somewhere safe — it&apos;s your backup if you lose your passkey device.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
