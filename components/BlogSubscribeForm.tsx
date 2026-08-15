'use client';

import { useState, type FormEvent } from 'react';

type State = 'idle' | 'sending' | 'success' | 'error';

export default function BlogSubscribeForm({ compact = false }: { compact?: boolean }) {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [state,    setState]    = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setState('sending');
    try {
      const res = await fetch('/api/blog/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      if (res.ok) {
        setState('success');
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || 'Something went wrong. Please try again.');
        setState('error');
      }
    } catch {
      setErrorMsg('Could not connect. Please try again.');
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <div className="card-dr p-7 text-center max-w-lg mx-auto">
        <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-100 mb-2">You&apos;re subscribed</h3>
        <p className="text-slate-400 text-sm">
          We&apos;ll send new articles to <strong className="text-slate-200">{email}</strong> when we publish them.
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="card-dr p-5">
        <p className="text-sm font-semibold text-slate-200 mb-1">Get new posts by email</p>
        <p className="text-xs text-slate-500 mb-4">No spam — just articles when we publish them.</p>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-dr-base border border-slate-700 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            type="submit"
            disabled={state === 'sending'}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {state === 'sending' ? 'Subscribing…' : 'Subscribe'}
          </button>
        </form>
        {state === 'error' && (
          <p className="text-xs text-red-400 mt-2">{errorMsg}</p>
        )}
      </div>
    );
  }

  return (
    <div className="card-dr p-7 max-w-lg mx-auto">
      <h3 className="text-lg font-bold text-slate-100 mb-1">Stay in the loop</h3>
      <p className="text-slate-500 text-sm mb-6">
        Get new posts delivered to your inbox. No spam — just articles when we publish them.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="sub-name" className="block text-xs font-medium text-slate-400 mb-1.5">
            Your name <span className="text-slate-600">(optional)</span>
          </label>
          <input
            id="sub-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Jane Smith"
            className="w-full px-4 py-2.5 rounded-lg bg-dr-base border border-slate-700 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div>
          <label htmlFor="sub-email" className="block text-xs font-medium text-slate-400 mb-1.5">
            Email address
          </label>
          <input
            id="sub-email"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="jane@example.com"
            className="w-full px-4 py-2.5 rounded-lg bg-dr-base border border-slate-700 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        {state === 'error' && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {errorMsg}
          </p>
        )}
        <button
          type="submit"
          disabled={state === 'sending'}
          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
        >
          {state === 'sending' ? 'Subscribing…' : 'Subscribe to blog'}
        </button>
      </form>
    </div>
  );
}
