'use client';

import { useState } from 'react';
import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';

// Profile → Passkeys & security: replace the recovery code. Confirms with a passkey
// (or, for accounts without one, the password / current code). Shown once.
export default function RecoveryCodeCard() {
  const [stage, setStage] = useState<'idle' | 'working' | 'secret' | 'shown'>('idle');
  const [method, setMethod] = useState<'password' | 'code'>('password');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  async function finish(payload: Record<string, unknown>) {
    const r = await fetch('/api/user/recovery-code', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.code) { setError(d.error ?? 'Could not create a new code'); return false; }
    setCode(d.code); setSaved(false); setCopied(false); setStage('shown');
    return true;
  }

  async function start() {
    if (!confirm('Create a new recovery code? Your old code will stop working straight away.')) return;
    setError(''); setStage('working');
    try {
      const r = await fetch('/api/user/recovery-code/options', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? 'Could not start'); setStage('idle'); return; }
      if (d.method !== 'passkey') { setMethod(d.method); setSecret(''); setStage('secret'); return; }
      if (!browserSupportsWebAuthn()) { setError('This browser does not support passkeys'); setStage('idle'); return; }
      let assertion;
      try {
        assertion = await startAuthentication({ optionsJSON: d.options });
      } catch (err) {
        if ((err as { name?: string }).name !== 'NotAllowedError') setError('Passkey check failed');
        setStage('idle'); return;
      }
      if (!(await finish({ assertion }))) setStage('idle');
    } catch { setError('Something went wrong'); setStage('idle'); }
  }

  async function submitSecret(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setStage('working');
    const ok = await finish(method === 'password' ? { password: secret } : { currentCode: secret });
    if (!ok) setStage('secret');
  }

  async function copy() {
    try { await navigator.clipboard.writeText(code); setCopied(true); } catch { /* select manually */ }
  }

  if (stage === 'shown') {
    return (
      <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <p className="text-sm font-semibold text-amber-300">Your new recovery code</p>
        <p className="mt-1 text-xs text-slate-400">
          Shown <strong className="text-slate-200">once only</strong>. Save it in your password manager now.
          Your old code no longer works.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <code className="select-all rounded-lg border border-slate-700 bg-dr-surface px-3 py-2 font-mono text-base tracking-wider text-slate-100">{code}</code>
          <button type="button" onClick={copy} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700/40">
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} />
          I have saved my recovery code
        </label>
        <button type="button" disabled={!saved} onClick={() => { setCode(''); setStage('idle'); }}
          className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40">
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="text-xs text-slate-600">
        Your recovery code lets you log in on a device without your passkey. Keep it somewhere safe.
        Lost it? Make a new one; the old one stops working.
      </p>
      {stage === 'secret' ? (
        <form onSubmit={submitSecret} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type={method === 'password' ? 'password' : 'text'}
            value={secret} onChange={e => setSecret(e.target.value)} required autoFocus autoComplete="off"
            placeholder={method === 'password' ? 'Your password' : 'Current recovery code'}
            className="rounded-lg border border-slate-700 bg-dr-surface px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none"
          />
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">Confirm</button>
          <button type="button" onClick={() => setStage('idle')} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
        </form>
      ) : (
        <button type="button" onClick={start} disabled={stage === 'working'}
          className="mt-3 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700/40 disabled:opacity-50">
          {stage === 'working' ? 'Confirm with your passkey…' : 'Generate a new recovery code'}
        </button>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
