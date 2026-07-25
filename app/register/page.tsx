'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { useAuth } from '@/components/AuthProvider';

const TIER_LABELS: Record<string, string> = {
  follower:  'Follower (Free)',
  voter:     'Voter — £2/mo',
  debater:   'Debater — £4/mo',
  moderator: 'Moderator — £9/mo',
};

const TIER_LABELS_ANNUAL: Record<string, string> = {
  follower:  'Follower (Free)',
  voter:     'Voter — £1.50/mo',
  debater:   'Debater — £3/mo',
  moderator: 'Moderator — £6.75/mo',
};

const BIO_MAX = 200;

function AccessCodeScreen({ code, onDone }: { code: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
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
        <h2 className="text-xl font-bold text-slate-100 mb-2">Save your recovery code</h2>
        <p className="text-sm text-slate-400 mb-5">
          Your passkey is set up. This recovery code is shown <strong className="text-slate-200">once only</strong> —
          keep it somewhere safe in case you lose access to your passkey device.
        </p>
        <div className="rounded-xl bg-dr-surface border border-blue-700/20 px-6 py-4 mb-5">
          <p className="font-mono text-lg font-bold tracking-widest text-blue-300 select-all">
            {code}
          </p>
        </div>
        <label className="flex items-center gap-2 justify-center mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={saved}
            onChange={e => setSaved(e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-dr-surface accent-blue-500"
          />
          <span className="text-sm text-slate-300">I have saved my recovery code</span>
        </label>
        <button
          onClick={onDone}
          disabled={!saved}
          className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue to debate.report
        </button>
      </div>
    </div>
  );
}

function RegisterForm() {
  const params   = useSearchParams();
  const router   = useRouter();
  const { refresh } = useAuth();

  const billingParam = params.get('billing') === 'annual';
  const [tier,        setTier]        = useState(params.get('tier') || 'follower');
  const [annual]                      = useState(billingParam);
  const [userHandle,  setUserHandle]  = useState('');
  const [email,       setEmail]       = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio,         setBio]         = useState('');
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [accessCode,  setAccessCode]  = useState<string | null>(null);

  if (accessCode) {
    return (
      <AccessCodeScreen
        code={accessCode}
        onDone={() => refresh().then(() => router.push('/'))}
      />
    );
  }

  async function register() {
    setError('');

    if (!userHandle.trim() || userHandle.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(userHandle)) {
      setError('Username may only contain letters, numbers, _ and -');
      return;
    }
    if (bio.length > BIO_MAX) {
      setError(`Bio must be ${BIO_MAX} characters or fewer`);
      return;
    }
    if (!browserSupportsWebAuthn()) {
      setError('Your browser does not support passkeys. Please use a modern browser.');
      return;
    }

    setLoading(true);
    try {
      // Step 1 — get options from server
      const optRes = await fetch('/api/auth/passkey/register-options', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          userHandle:  userHandle.trim(),
          email:       email.trim() || undefined,
          tier,
          displayName: displayName.trim() || undefined,
          bio:         bio.trim() || undefined,
        }),
      });
      const optData = await optRes.json();
      if (!optRes.ok) { setError(optData.error || 'Failed to start registration'); return; }

      // Step 2 — browser biometric ceremony
      let credential;
      try {
        credential = await startRegistration({ optionsJSON: optData });
      } catch (err) {
        if (err instanceof Error && err.name === 'NotAllowedError') {
          setError('Passkey registration was cancelled.');
        } else {
          setError('Passkey registration failed. Please try again.');
        }
        return;
      }

      // Step 3 — verify on server
      const verRes = await fetch('/api/auth/passkey/register-verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(credential),
      });
      const verData = await verRes.json();
      if (!verRes.ok) { setError(verData.error || 'Verification failed'); return; }

      setAccessCode(verData.accessCode);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const tierLabels = annual ? TIER_LABELS_ANNUAL : TIER_LABELS;

  return (
    <div className="min-h-screen bg-dr-base flex items-center justify-center px-4 py-16">
      <div className="card-dr w-full max-w-md p-8">

        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-100 mb-1">Create your account</h1>
          <p className="text-sm text-slate-500">
            Signing up as{' '}
            <span className="text-blue-400">
              {tierLabels[tier] || tier}
              {annual && tier !== 'follower' && ' (annual)'}
            </span>.{' '}
            <Link href="/pricing" className="text-slate-500 underline underline-offset-2 hover:text-slate-400">
              Change
            </Link>
          </p>
        </div>

        <div className="space-y-4">

          {/* Username */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Username <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={userHandle}
              onChange={e => setUserHandle(e.target.value)}
              placeholder="your_username"
              autoComplete="username"
              className="w-full rounded-lg border border-slate-700 bg-dr-surface px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-600">Letters, numbers, _ and - only. Shown publicly.</p>
          </div>

          {/* Display name */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Display name <span className="text-slate-600">(optional)</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="e.g. Alice or The Pragmatist"
              autoComplete="name"
              className="w-full rounded-lg border border-slate-700 bg-dr-surface px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Short bio <span className="text-slate-600">(optional)</span>
            </label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="A sentence or two about your perspective or interests…"
              rows={3}
              maxLength={BIO_MAX + 10}
              className="w-full rounded-lg border border-slate-700 bg-dr-surface px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
            <p className={`mt-0.5 text-right text-xs ${bio.length > BIO_MAX ? 'text-red-400' : 'text-slate-600'}`}>
              {bio.length}/{BIO_MAX}
            </p>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Email <span className="text-slate-600">(optional — for newsletter only)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full rounded-lg border border-slate-700 bg-dr-surface px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Tier selector */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Tier</label>
            <div className="grid grid-cols-2 gap-2">
              {(['follower', 'voter', 'debater', 'moderator'] as const).map(t => (
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
                  {tierLabels[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Passkey info */}
          <div className="rounded-lg border border-slate-700 bg-dr-surface px-4 py-3 flex items-start gap-3">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 0 1 21.75 8.25Z" />
            </svg>
            <p className="text-xs text-slate-400">
              We use <strong className="text-slate-300">passkeys</strong> — your device&apos;s biometrics (Face ID, fingerprint, Windows Hello).
              No password to remember. A recovery code is shown once after signup.
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={register}
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              'Creating account…'
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 0 1 21.75 8.25Z" />
                </svg>
                Create account with passkey
              </>
            )}
          </button>
        </div>

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
