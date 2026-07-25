'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { useAuth } from '@/components/AuthProvider';

function LoginForm() {
  const router   = useRouter();
  const params   = useSearchParams();
  const { refresh } = useAuth();
  const next = params.get('next') || '/';

  const [identifier,  setIdentifier]  = useState('');
  const [accessCode,  setAccessCode]  = useState('');
  const [showFallback, setShowFallback] = useState(false);
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);

  async function loginWithPasskey() {
    setError('');
    if (!identifier.trim()) {
      setError('Enter your username or email first');
      return;
    }
    if (!browserSupportsWebAuthn()) {
      setError('Your browser does not support passkeys. Use your recovery code instead.');
      setShowFallback(true);
      return;
    }

    setLoading(true);
    try {
      // Step 1 — get options
      const optRes = await fetch('/api/auth/passkey/login-options', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ identifier: identifier.trim() }),
      });
      const optData = await optRes.json();
      if (!optRes.ok) { setError(optData.error || 'Failed to start login'); return; }

      // Step 2 — browser biometric ceremony
      let assertion;
      try {
        assertion = await startAuthentication({ optionsJSON: optData });
      } catch (err) {
        if (err instanceof Error && err.name === 'NotAllowedError') {
          setError('Passkey login was cancelled.');
        } else {
          setError('Passkey login failed. Use your recovery code if you have it.');
          setShowFallback(true);
        }
        return;
      }

      // Step 3 — verify on server
      const verRes = await fetch('/api/auth/passkey/login-verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(assertion),
      });
      const verData = await verRes.json();
      if (!verRes.ok) { setError(verData.error || 'Login failed'); return; }

      await refresh();
      router.push(next);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function loginWithCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ identifier: identifier.trim(), accessCode }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      await refresh();
      router.push(next);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-dr-base flex items-center justify-center px-4 py-16">
      <div className="card-dr w-full max-w-sm p-8">
        <h1 className="text-xl font-bold text-slate-100 mb-6">Log in</h1>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Username or email</label>
            <input
              type="text"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              placeholder="your_username"
              autoComplete="username"
              className="w-full rounded-lg border border-slate-700 bg-dr-surface px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {!showFallback ? (
            <>
              <button
                onClick={loginWithPasskey}
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  'Logging in…'
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 0 1 21.75 8.25Z" />
                    </svg>
                    Log in with passkey
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowFallback(true)}
                className="w-full text-center text-xs text-slate-600 hover:text-slate-400 transition-colors"
              >
                Use recovery code instead
              </button>
            </>
          ) : (
            <form onSubmit={loginWithCode} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Recovery code</label>
                <input
                  type="text"
                  value={accessCode}
                  onChange={e => setAccessCode(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  required
                  autoComplete="off"
                  className="w-full rounded-lg border border-slate-700 bg-dr-surface px-3 py-2.5 font-mono text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
              >
                {loading ? 'Logging in…' : 'Log in with recovery code'}
              </button>

              <button
                type="button"
                onClick={() => { setShowFallback(false); setError(''); }}
                className="w-full text-center text-xs text-slate-600 hover:text-slate-400 transition-colors"
              >
                Back to passkey login
              </button>
            </form>
          )}

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          No account?{' '}
          <Link href="/pricing" className="text-blue-400 hover:text-blue-300">See plans</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
