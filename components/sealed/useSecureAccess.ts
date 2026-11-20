'use client';

// Your secure access (for Sealed items) in this browser: not set up, set up but
// locked on this device (enter your recovery phrase), or ready. One shared state
// for the whole page.

import { useEffect, useState } from 'react';
import {
  lockIdentity, lockWithPasskey, newIdentity, PRF_SALT, toB64, unlockIdentity, unlockWithPasskey, type Identity, type StoredIdentity,
} from '@/lib/sealed/core';
import { forgetKey, recallKey, rememberKey } from './keystore';
import { x25519 } from '@noble/curves/ed25519';

/** One of the account's passkeys; `lock` is set when it unlocks secure access. */
export type AccountPasskey = { credentialId: string; deviceType: string | null; createdAt: string; lastUsedAt: string | null; lock: string | null; unlocksSince: string | null };

export type SecureAccess = {
  status: 'loading' | 'signed-out' | 'none' | 'locked' | 'ready' | 'error';
  userId?: string; stored?: StoredIdentity | null; identity?: Identity; passkeys?: AccountPasskey[];
};

let state: SecureAccess = { status: 'loading' };
let loading: Promise<void> | null = null;
const listeners = new Set<(s: SecureAccess) => void>();
const publish = (s: SecureAccess) => { state = s; listeners.forEach(l => l(s)); };

async function load() {
  try {
    const r = await fetch('/api/user/sealed-key');
    if (r.status === 401) return publish({ status: 'signed-out' });
    if (!r.ok) return publish({ status: 'error' });
    const { identity: stored, userId, passkeys } = await r.json() as { identity: StoredIdentity | null; userId: string; passkeys: AccountPasskey[] };
    if (!stored) return publish({ status: 'none', userId, stored: null, passkeys });
    const privateKey = await recallKey(userId, stored.publicKey);
    publish(privateKey
      ? { status: 'ready', userId, stored, passkeys, identity: { privateKey, publicKey: x25519.getPublicKey(privateKey) } }
      : { status: 'locked', userId, stored, passkeys });
  } catch { publish({ status: 'error' }); }
}

async function save(identity: Identity, phrase: string, reset: boolean) {
  const userId = state.userId!;
  const stored = lockIdentity(identity, phrase, userId);
  const r = await fetch('/api/user/sealed-key', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...stored, reset }) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Couldn’t save your secure access');
  await rememberKey(userId, identity.privateKey, stored.publicKey);
  // A new identity: passkeys that unlocked the old one no longer do
  publish({ status: 'ready', userId, stored, identity, passkeys: state.passkeys?.map(p => ({ ...p, lock: null, unlocksSince: null })) });
}

/** Set up secure access with a recovery phrase the person has written down. */
export const setUp = (phrase: string) => save(newIdentity(), phrase, false);

/** Lost phrase: a new key. Members' browsers share sealed items with it again as they come online. */
export const resetAccess = (phrase: string) => save(newIdentity(), phrase, true);

/** Unlock on this device with the recovery phrase. Throws on a wrong phrase. */
export async function unlock(phrase: string) {
  const { userId, stored } = state;
  if (!userId || !stored) throw new Error('Secure access isn’t set up');
  let identity: Identity;
  try { identity = unlockIdentity(stored, phrase, userId); } catch { throw new Error('That recovery phrase doesn’t match. Check each word.'); }
  await rememberKey(userId, identity.privateKey, stored.publicKey);
  publish({ ...state, status: 'ready', userId, stored, identity });
}

// ── Passkeys ─────────────────────────────────────────────────────────────────

const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), c => c.charCodeAt(0));
const toB64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const passkeysSupported = () => typeof window !== 'undefined' && !!window.PublicKeyCredential;

/** Ask for one of these passkeys and its PRF secret for secure access (null if the passkey can't give one). */
async function passkeySecret(credentialIds: string[]): Promise<{ credentialId: string; prf: Uint8Array | null }> {
  let cred: PublicKeyCredential | null;
  try {
    cred = await navigator.credentials.get({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),   // nothing is signed for the server: only the PRF secret is used
      allowCredentials: credentialIds.map(id => ({ type: 'public-key' as const, id: fromB64url(id) })),
      userVerification: 'required', timeout: 120000,
      extensions: { prf: { eval: { first: new Uint8Array(PRF_SALT) } } } as AuthenticationExtensionsClientInputs,
    } }) as PublicKeyCredential | null;
  } catch (e) {
    throw new Error((e as Error)?.name === 'NotAllowedError' ? 'The passkey wasn’t used (cancelled, or none of yours is on this device).' : 'The passkey couldn’t be used here.');
  }
  if (!cred) throw new Error('No passkey was chosen');
  const out = (cred.getClientExtensionResults() as { prf?: { results?: { first?: ArrayBuffer } } }).prf?.results?.first;
  return { credentialId: toB64url(new Uint8Array(cred.rawId)), prf: out ? new Uint8Array(out) : null };
}

const NO_PRF = 'This passkey can’t unlock secure access: the device or password manager holding it doesn’t support it. Passkeys in a recent iPhone, Mac, Android phone, Windows Hello, Chrome or 1Password usually can.';

/** Let a passkey of this account unlock secure access on new devices (secure access must be unlocked here). */
export async function addPasskeyUnlock(only?: string) {
  const { userId, identity, passkeys } = state;
  if (!userId || !identity) throw new Error('Unlock secure access on this device first');
  if (!passkeys?.length) throw new Error('Your account has no passkeys yet: add one first (under Passkeys)');
  const { credentialId, prf } = await passkeySecret(only ? [only] : passkeys.map(p => p.credentialId));
  if (!prf) throw new Error(NO_PRF);
  const r = await fetch('/api/user/sealed-key', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credentialId, lock: lockWithPasskey(identity, prf, userId) }) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Couldn’t save');
  await refreshPasskeys();
}

/** Unlock secure access on this device with a passkey that unlocks it. */
export async function unlockWithAPasskey() {
  const { userId, stored, passkeys } = state;
  const usable = (passkeys ?? []).filter(p => p.lock);
  if (!userId || !stored || !usable.length) throw new Error('None of your passkeys unlocks secure access yet');
  const { credentialId, prf } = await passkeySecret(usable.map(p => p.credentialId));
  if (!prf) throw new Error(NO_PRF);
  const lock = usable.find(p => p.credentialId === credentialId)?.lock;
  if (!lock) throw new Error('That passkey doesn’t unlock secure access');
  let identity: Identity;
  try { identity = unlockWithPasskey(lock, prf, userId, stored.publicKey); } catch { throw new Error('That passkey couldn’t unlock secure access'); }
  await rememberKey(userId, identity.privateKey, stored.publicKey);
  publish({ ...state, status: 'ready', identity });
}

/** That passkey no longer unlocks secure access. */
export async function removePasskeyUnlock(credentialId: string) {
  await fetch('/api/user/sealed-key', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credentialId }) });
  await refreshPasskeys();
}

export async function refreshPasskeys() {
  const r = await fetch('/api/user/sealed-key');
  if (r.ok) publish({ ...state, passkeys: (await r.json()).passkeys });
}

/** Forget the key on this device (it stays usable elsewhere with the phrase). */
export async function lockThisDevice() {
  if (state.userId) await forgetKey(state.userId);
  publish({ ...state, status: state.stored ? 'locked' : 'none', identity: undefined });
}

/** Secure access once it has loaded (for code outside components, e.g. when fetching data). */
export async function secureAccessNow(): Promise<SecureAccess> {
  if (state.status === 'loading') {
    if (!loading) loading = load().finally(() => { loading = null; });
    await loading;
  }
  return state;
}

export function useSecureAccess(): SecureAccess {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    setS(state);
    if (state.status === 'loading' && !loading) loading = load().finally(() => { loading = null; });
    return () => { listeners.delete(setS); };
  }, []);
  return s;
}

export const myPublicKey = (s: SecureAccess) => s.identity ? toB64(s.identity.publicKey) : s.stored?.publicKey ?? null;
