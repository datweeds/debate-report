'use client';

import { useMemo, useState } from 'react';
import { Sheet } from '@/components/projects/shared';
import { isPhrase, newPhrase, normalPhrase } from '@/lib/sealed/core';
import { passkeysSupported, resetAccess, setUp, unlock, unlockWithAPasskey, useSecureAccess } from './useSecureAccess';

// Set up secure access (choose a recovery phrase), unlock it on this device, or
// reset it after losing the phrase.
export default function SecureAccessDialog({ mode: initial, onDone, onClose }: {
  mode: 'setup' | 'unlock'; onDone: () => void; onClose: () => void;
}) {
  const [mode, setMode] = useState<'setup' | 'unlock' | 'reset'>(initial);
  const access = useSecureAccess();
  const canUsePasskey = passkeysSupported() && !!access.passkeys?.some(p => p.lock);
  const phrase = useMemo(() => newPhrase(), []);
  const words = phrase.split(' ');
  const [saved, setSaved] = useState(false);
  const [check, setCheck] = useState({ a: '', b: '' });
  const [entered, setEntered] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  // Two words to type back, so the phrase is really written down
  const [ia, ib] = useMemo(() => { const a = Math.floor(Math.random() * 6); return [a, 6 + Math.floor(Math.random() * 6)]; }, []);

  async function run(f: () => Promise<void>) {
    setBusy(true); setError('');
    try { await f(); onDone(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const checked = check.a.trim().toLowerCase() === words[ia] && check.b.trim().toLowerCase() === words[ib];

  if (mode === 'unlock') {
    return (
      <Sheet title="Unlock secure access" onClose={onClose}>
        {canUsePasskey && (
          <div className="mb-4 rounded-xl border border-blue-500/30 bg-blue-500/5 p-3">
            <p className="text-sm text-slate-300">Use the passkey you set up for this, from this device or your phone.</p>
            <button disabled={busy} onClick={() => run(unlockWithAPasskey)}
              className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">{busy ? 'Waiting for your passkey…' : '🔑 Unlock with a passkey'}</button>
            <p className="mt-3 text-xs text-slate-500">Or use your recovery phrase:</p>
          </div>
        )}
        <p className="text-sm text-slate-300">
          Enter your 12-word recovery phrase to read Sealed items on this device. You only need to do this once per device.
        </p>
        <textarea value={entered} onChange={e => setEntered(e.target.value)} rows={3} autoFocus spellCheck={false} autoComplete="off"
          placeholder="twelve words separated by spaces" className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 focus:border-blue-500 focus:outline-none" />
        {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button disabled={busy || !isPhrase(entered)} onClick={() => run(() => unlock(normalPhrase(entered)))}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">{busy ? 'Unlocking…' : 'Unlock'}</button>
          <button onClick={() => setMode('reset')} className="text-xs text-slate-400 hover:text-slate-200">Lost your phrase?</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={mode === 'reset' ? 'Reset secure access' : 'Set up secure access'} onClose={onClose}>
      {mode === 'reset' ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          This replaces your secure access with a new key. You lose access to Sealed items until another member opens them, when their
          browser shares them with you again automatically. If you were the only member able to read an item, it can’t be recovered.
        </p>
      ) : (
        <p className="text-sm text-slate-300">
          Sealed items are encrypted in members’ browsers: only members can read them, not new.vote. Your key is made on this device.
          It’s protected by a recovery phrase, which you need to read Sealed items on another device. <span className="font-semibold text-slate-100">We can’t recover it for you.</span>
        </p>
      )}
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Your recovery phrase</p>
      <ol className="mt-2 grid grid-cols-3 gap-2 rounded-xl border border-slate-700 bg-slate-900 p-3 font-mono text-sm text-slate-100 sm:grid-cols-4">
        {words.map((w, i) => <li key={i}><span className="mr-1.5 text-xs text-slate-500">{i + 1}.</span>{w}</li>)}
      </ol>
      <div className="mt-2 flex items-center gap-3 text-xs">
        <button type="button" title="Click to copy to clipboard" className="text-blue-400 hover:text-blue-300"
          onClick={async () => { try { await navigator.clipboard.writeText(phrase); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } }}>
          Copy phrase
        </button>
        {copied && <span role="status" className="font-semibold text-emerald-400">Copied to clipboard</span>}
        <span className="text-slate-500">Keep it somewhere safe and private, such as a password manager or on paper.</span>
      </div>
      <label className="mt-4 flex items-start gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} className="mt-1 accent-blue-500" />
        I’ve written these 12 words down somewhere safe.
      </label>
      {saved && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-400">Word {ia + 1}
            <input value={check.a} onChange={e => setCheck(c => ({ ...c, a: e.target.value }))} autoComplete="off" spellCheck={false}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-sm text-slate-100" />
          </label>
          <label className="text-xs text-slate-400">Word {ib + 1}
            <input value={check.b} onChange={e => setCheck(c => ({ ...c, b: e.target.value }))} autoComplete="off" spellCheck={false}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-sm text-slate-100" />
          </label>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      <button disabled={busy || !saved || !checked} onClick={() => run(() => (mode === 'reset' ? resetAccess : setUp)(phrase))}
        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
        {busy ? 'Setting up…' : mode === 'reset' ? 'Reset secure access' : 'Set up secure access'}
      </button>
    </Sheet>
  );
}
