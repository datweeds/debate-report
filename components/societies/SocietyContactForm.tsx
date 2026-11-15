'use client';

import { useState } from 'react';

const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none';

export default function SocietyContactForm({ societyId }: { societyId: number; loggedIn: boolean }) {
  const [f, setF] = useState({ name: '', email: '', message: '', website: '' });
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState('sending'); setError('');
    const r = await fetch(`/api/societies/${societyId}/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    if (r.ok) { setState('sent'); return; }
    setState('idle'); setError((await r.json().catch(() => ({}))).error ?? 'Could not send');
  }
  if (state === 'sent') return <p className="mt-3 text-sm text-emerald-300">Sent. The moderators will reply by email.</p>;
  return (
    <form onSubmit={send} className="mt-3 space-y-2">
      <input value={f.name} onChange={e => setF(v => ({ ...v, name: e.target.value }))} required maxLength={100} placeholder="Your name" className={inputCls} />
      <input value={f.email} onChange={e => setF(v => ({ ...v, email: e.target.value }))} required type="email" placeholder="Your email (for their reply)" className={inputCls} />
      <textarea value={f.message} onChange={e => setF(v => ({ ...v, message: e.target.value }))} required rows={4} maxLength={5000} placeholder="Message" className={inputCls} />
      {/* Honeypot: hidden from people, filled by bots */}
      <input value={f.website} onChange={e => setF(v => ({ ...v, website: e.target.value }))} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <button type="submit" disabled={state === 'sending'} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
        {state === 'sending' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
