'use client';

import { useState } from 'react';

export default function AcceptInviteButton({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'joining' | 'error'>('idle');
  async function accept() {
    setState('joining');
    const r = await fetch('/api/societies/join-invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
    });
    if (!r.ok) { setState('error'); return; }
    const { societyId } = await r.json();
    await fetch('/api/customer/switch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_id: societyId }),
    });
    window.location.href = `/scotparl?society=${societyId}`;
  }
  return (
    <div className="flex items-center gap-3">
      <button onClick={accept} disabled={state === 'joining'}
        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
        {state === 'joining' ? 'Joining…' : 'Join this Society'}
      </button>
      {state === 'error' && <span className="text-xs text-rose-400">This invitation is no longer valid.</span>}
    </div>
  );
}
