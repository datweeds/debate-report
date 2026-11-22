'use client';

import Link from 'next/link';
import { useState } from 'react';

// "Request to join" for an Apply Society, shown on its teaser page; or, with
// `instant`, "Join this Society" for a public one.
export default function JoinSocietyButton({ societyId, loggedIn, pending, instant }: {
  societyId: number; loggedIn: boolean; pending: boolean; instant?: boolean;
}) {
  const [state, setState] = useState<'idle' | 'open' | 'sending' | 'sent' | 'error'>(pending ? 'sent' : 'idle');
  const [message, setMessage] = useState('');

  if (!loggedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(`/scotparl?society=${societyId}`)}`}
        className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
        Log in to request to join
      </Link>
    );
  }
  if (state === 'sent') {
    return <p className="text-sm text-emerald-300">Request sent. A Society Admin will review it.</p>;
  }
  if (instant) {
    return (
      <button disabled={state === 'sending'} onClick={async () => {
        setState('sending');
        const r = await fetch(`/api/societies/${societyId}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        if (r.ok) window.location.reload(); else setState('error');
      }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
        {state === 'sending' ? 'Joining…' : state === 'error' ? 'Could not join; try again' : 'Join this Society'}
      </button>
    );
  }

  async function send() {
    setState('sending');
    const r = await fetch(`/api/societies/${societyId}/join`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    setState(r.ok ? 'sent' : 'error');
  }

  return state === 'idle' ? (
    <button onClick={() => setState('open')} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
      Request to join
    </button>
  ) : (
    <div className="space-y-2 max-w-lg">
      <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} maxLength={1000}
        placeholder="Optional: tell the Society Admins why you'd like to join"
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-600" />
      <div className="flex items-center gap-3">
        <button onClick={send} disabled={state === 'sending'} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
          {state === 'sending' ? 'Sending…' : 'Send request'}
        </button>
        <button onClick={() => setState('idle')} className="text-sm text-slate-500 hover:text-slate-300">Cancel</button>
        {state === 'error' && <span className="text-xs text-rose-400">Could not send — please try again.</span>}
      </div>
    </div>
  );
}
