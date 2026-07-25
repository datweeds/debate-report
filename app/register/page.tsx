'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

const TIER_LABELS: Record<string, string> = {
  family: 'Family (Free)',
  debater: 'Public Debater',
  moderator: 'Moderator',
};

function RegisterForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { refresh } = useAuth();

  const [tier, setTier] = useState(params.get('tier') || 'family');
  const [incognito, setIncognito] = useState(params.get('incognito') === 'true');
  const [userHandle, setUserHandle] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [codeSaved, setCodeSaved] = useState(false);

  useEffect(() => {
    if (params.get('incognito') === 'true') setIncognito(true);
  }, [params]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!incognito && password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userHandle, email, password, tier, incognito }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Registration failed'); return; }

      if (data.accessCode) {
        setAccessCode(data.accessCode);
      } else {
        await refresh();
        router.push('/');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function afterCodeSaved() {
    refresh().then(() => router.push('/'));
  }

  // Show access code confirmation screen
  if (accessCode) {
    return (
      <div className="min-h-screen bg-dr-base flex items-center justify-center px-4 py-16">
        <div className="card-dr w-full max-w-md p-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-emerald-500/10 p-3">
              <svg className="h-8 w-8 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 0 1 21.75 8.25Z" />
              </svg>
            </div>
          </div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">Your access code</h2>
          <p className="text-sm text-slate-400 mb-5">
            This is shown <strong className="text-slate-200">once only</strong>. Save it somewhere safe —
            it&apos;s your only way to log back in.
          </p>
          <div className="rounded-xl bg-dr-surface border border-blue-700/20 px-6 py-4 mb-5">
            <p className="font-mono text-lg font-bold tracking-widest text-blue-300 select-all">
              {accessCode}
            </p>
          </div>
          <label className="flex items-center gap-2 justify-center mb-5 cursor-pointer">
            <input
              type="checkbox"
              checked={codeSaved}
              onChange={e => setCodeSaved(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-dr-surface accent-blue-500"
            />
            <span className="text-sm text-slate-300">I have saved my access code</span>
          </label>
          <button
            onClick={afterCodeSaved}
            disabled={!codeSaved}
            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue to debate.report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dr-base flex items-center justify-center px-4 py-16">
      <div className="card-dr w-full max-w-md p-8">

        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-100 mb-1">Create your account</h1>
          <p className="text-sm text-slate-500">
            Signing up as{' '}
            <span className="text-blue-400">{TIER_LABELS[tier] || tier}</span>.{' '}
            <Link href="/pricing" className="text-slate-500 underline underline-offset-2 hover:text-slate-400">
              Change
            </Link>
          </p>
        </div>

        {/* Incognito toggle */}
        <div className="mb-5 rounded-xl border border-slate-700 bg-dr-surface p-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-200">Incognito mode</p>
            <p className="text-xs text-slate-500">No email stored. We generate an access code.</p>
          </div>
          <button
            type="button"
            onClick={() => setIncognito(v => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${incognito ? 'bg-blue-600' : 'bg-slate-600'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${incognito ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Username <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={userHandle}
              onChange={e => setUserHandle(e.target.value)}
              placeholder="your_username"
              required
              className="w-full rounded-lg border border-slate-700 bg-dr-surface px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-600">Letters, numbers, _ and - only. Shown publicly.</p>
          </div>

          {!incognito && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Email <span className="text-slate-600">(optional)</span></label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-slate-700 bg-dr-surface px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Password <span className="text-red-400">*</span></label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-slate-700 bg-dr-surface px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Confirm password <span className="text-red-400">*</span></label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-lg border border-slate-700 bg-dr-surface px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {incognito && (
            <div className="rounded-lg border border-blue-700/20 bg-blue-500/5 px-4 py-3 text-xs text-slate-400">
              An access code will be generated for you. No email or personal data will be stored.
              Your username is your only public identity on the platform.
            </div>
          )}

          {/* Tier selector */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Tier</label>
            <div className="grid grid-cols-3 gap-2">
              {(['family', 'debater', 'moderator'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                    tier === t
                      ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                      : 'border-slate-700 text-slate-500 hover:border-slate-600'
                  }`}
                >
                  {TIER_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-600">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-400 hover:text-blue-300">Log in</Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
