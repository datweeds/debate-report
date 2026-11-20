'use client';

import { useEffect, useState } from 'react';
import SecureAccessDialog from './SecureAccessDialog';
import {
  addPasskeyUnlock, lockThisDevice, passkeysSupported, refreshPasskeys, removePasskeyUnlock, useSecureAccess, type AccountPasskey,
} from './useSecureAccess';

const day = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const label = (p: AccountPasskey) => p.deviceType === 'multiDevice' ? 'Synced passkey' : p.deviceType === 'singleDevice' ? 'Device-bound passkey' : 'Passkey';

// Secure access (for Sealed items) on the profile page: its state on this
// device, and which passkeys can unlock it on new devices instead of the
// recovery phrase. `passkeyCount` changes when the account's passkeys do.
export default function SecureAccessCard({ passkeyCount }: { passkeyCount: number }) {
  const access = useSecureAccess();
  const [dialog, setDialog] = useState<'setup' | 'unlock' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { if (access.status === 'ready' || access.status === 'locked' || access.status === 'none') void refreshPasskeys(); },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [passkeyCount]);

  async function run(id: string, f: () => Promise<void>, done: string) {
    setBusy(id); setError(''); setNote('');
    try { await f(); setNote(done); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  if (access.status === 'loading' || access.status === 'signed-out' || access.status === 'error') return null;
  const passkeys = access.passkeys ?? [];
  const unlocking = passkeys.filter(p => p.lock);

  return (
    <section id="secure-access" className="rounded-2xl border border-slate-800 bg-dr-card p-5">
      {dialog && <SecureAccessDialog mode={dialog} onDone={() => setDialog(null)} onClose={() => setDialog(null)} />}
      <h2 className="text-base font-semibold text-slate-100">🔐 Secure access</h2>
      <p className="mt-1 text-sm text-slate-400">
        Your key for Sealed items: discussions, debates, projects and more that are encrypted in members’ browsers, so only members can read them.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 p-3 text-sm">
        {access.status === 'none' && <>
          <span className="text-slate-300">Not set up yet.</span>
          <button onClick={() => setDialog('setup')} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500">Set up secure access</button>
        </>}
        {access.status === 'locked' && <>
          <span className="text-slate-300">Set up, but locked on this device.</span>
          <button onClick={() => setDialog('unlock')} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500">Unlock on this device</button>
        </>}
        {access.status === 'ready' && <>
          <span className="font-semibold text-emerald-300">Unlocked on this device</span>
          <button onClick={() => run('lock', lockThisDevice, 'Locked on this device. Unlock again with a passkey or your recovery phrase.')}
            className="text-xs text-slate-400 hover:text-slate-200">Lock this device</button>
        </>}
      </div>

      {access.status !== 'none' && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Unlock new devices with a passkey</p>
          <p className="mt-1 text-xs text-slate-500">
            Instead of typing your 12-word recovery phrase on a new device, use one of your passkeys. Keep your recovery phrase anyway: it still works if you lose your passkeys.
          </p>
          {!passkeysSupported() ? (
            <p className="mt-2 text-sm text-slate-500">This browser can’t use passkeys.</p>
          ) : passkeys.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Your account has no passkeys yet. Add one under Passkeys &amp; security, then come back here.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {passkeys.map(p => (
                <li key={p.credentialId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700/50 px-3 py-2">
                  <div>
                    <p className="text-sm text-slate-200">{label(p)} <span className="text-xs text-slate-500">· added {day(p.createdAt)}</span></p>
                    {p.lock && <p className="text-xs text-emerald-300">Unlocks secure access{p.unlocksSince ? ` (since ${day(p.unlocksSince)})` : ''}</p>}
                  </div>
                  {p.lock ? (
                    <button onClick={() => run(p.credentialId, () => removePasskeyUnlock(p.credentialId), 'That passkey no longer unlocks secure access.')}
                      disabled={busy === p.credentialId} className="text-xs text-slate-400 hover:text-rose-300">Stop using for this</button>
                  ) : access.status === 'ready' ? (
                    <button onClick={() => run(p.credentialId, () => addPasskeyUnlock(p.credentialId), 'Done: this passkey now unlocks secure access on new devices.')}
                      disabled={!!busy} className="rounded-lg border border-blue-500/50 px-3 py-1 text-xs text-blue-300 hover:bg-blue-500/10 disabled:opacity-50">
                      {busy === p.credentialId ? 'Waiting for your passkey…' : 'Use to unlock secure access'}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {access.status === 'locked' && passkeys.length > 0 && !unlocking.length && (
            <p className="mt-2 text-xs text-slate-500">Unlock secure access on this device first, then choose a passkey here.</p>
          )}
        </div>
      )}
      {note && <p className="mt-3 text-xs text-emerald-300">{note}</p>}
      {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
    </section>
  );
}
