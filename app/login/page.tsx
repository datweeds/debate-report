'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const next = params.get('next') || '/';

  const [useCode, setUseCode] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          password: useCode ? undefined : password,
          accessCode: useCode ? accessCode : undefined,
        }),
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

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Username or email</label>
            <input
              type="text"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              placeholder="your_username"
              required
              autoComplete="username"
              className="w-full rounded-lg border border-slate-700 bg-dr-surface px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Toggle: password vs access code */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setUseCode(false)}
              className={`text-xs font-medium transition-colors ${!useCode ? 'text-blue-400' : 'text-slate-600 hover:text-slate-400'}`}
            >
              Password
            </button>
            <span className="text-slate-700">|</span>
            <button
              type="button"
              onClick={() => setUseCode(true)}
              className={`text-xs font-medium transition-colors ${useCode ? 'text-blue-400' : 'text-slate-600 hover:text-slate-400'}`}
            >
              Access code
            </button>
          </div>

          {useCode ? (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Access code</label>
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
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-700 bg-dr-surface px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

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
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-600">
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
