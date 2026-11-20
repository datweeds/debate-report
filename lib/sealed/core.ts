// Sealed items: end-to-end encryption, done in members' browsers. The server
// stores only what this module produces and can never read it. Pure functions,
// shared by the browser and tests; no server or DOM imports.
//
//   Identity   each person has an X25519 key pair, made in their browser. The
//              private key is stored on the server only inside a "vault",
//              encrypted with a random vault key, which is itself locked by the
//              person's recovery phrase. A passkey can open it too: its PRF
//              output (which never leaves the person's device) locks a copy.
//   Item key   each sealed item (a thread, ...) has a random key per "epoch";
//              it is locked separately for every member's public key. A new
//              epoch starts when someone leaves, so they can't read what follows.
//   Text       "sn1:<epoch>:<base64(nonce | ciphertext)>", XChaCha20-Poly1305,
//              bound to its item ("thread:<id>") so it can't be moved elsewhere.
//
// Swappable later for Secure Net's groups: the stored formats carry versions.

import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { randomBytes } from '@noble/ciphers/webcrypto';
import { x25519 } from '@noble/curves/ed25519';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { generateMnemonic, mnemonicToEntropy, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

export const PREFIX = 'sn1:';
const enc = new TextEncoder(), dec = new TextDecoder();

// ── Bytes ↔ text ─────────────────────────────────────────────────────────────

export function toB64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const join = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

// ── Authenticated encryption ─────────────────────────────────────────────────

/** nonce (24) | ciphertext, bound to `aad`. */
export function seal(key: Uint8Array, plain: Uint8Array, aad: string): Uint8Array {
  const nonce = randomBytes(24);
  return join(nonce, xchacha20poly1305(key, nonce, enc.encode(aad)).encrypt(plain));
}
/** Throws if the key, the data or `aad` don't match. */
export function open(key: Uint8Array, box: Uint8Array, aad: string): Uint8Array {
  return xchacha20poly1305(key, box.subarray(0, 24), enc.encode(aad)).decrypt(box.subarray(24));
}

// ── Identity, vault and recovery phrase ──────────────────────────────────────

export type Identity = { publicKey: Uint8Array; privateKey: Uint8Array };

export function newIdentity(): Identity {
  const privateKey = x25519.utils.randomPrivateKey();
  return { privateKey, publicKey: x25519.getPublicKey(privateKey) };
}

/** 12 words (128 bits). */
export const newPhrase = () => generateMnemonic(wordlist, 128);
export const isPhrase = (p: string) => validateMnemonic(normalPhrase(p), wordlist);
export const normalPhrase = (p: string) => p.trim().toLowerCase().split(/\s+/).join(' ');

/** The key a recovery phrase unlocks, for this person (the phrase is random, so HKDF is enough). */
export function phraseKey(phrase: string, userId: string): Uint8Array {
  const entropy = mnemonicToEntropy(normalPhrase(phrase), wordlist);
  return hkdf(sha256, entropy, enc.encode('new.vote sealed v1'), enc.encode(`phrase:${userId}`), 32);
}

/** What the server keeps: the private key in a vault, and the vault key locked by the phrase. */
export type StoredIdentity = { publicKey: string; vault: string; phraseLock: string };

export function lockIdentity(id: Identity, phrase: string, userId: string): StoredIdentity {
  const vaultKey = randomBytes(32);
  return {
    publicKey: toB64(id.publicKey),
    vault: toB64(seal(vaultKey, id.privateKey, `vault:${userId}`)),
    phraseLock: toB64(seal(phraseKey(phrase, userId), vaultKey, `phrase-lock:${userId}`)),
  };
}

/** The identity back from what the server keeps; throws on a wrong phrase. */
export function unlockIdentity(stored: StoredIdentity, phrase: string, userId: string): Identity {
  const vaultKey = open(phraseKey(phrase, userId), fromB64(stored.phraseLock), `phrase-lock:${userId}`);
  const privateKey = open(vaultKey, fromB64(stored.vault), `vault:${userId}`);
  const publicKey = x25519.getPublicKey(privateKey);
  if (toB64(publicKey) !== stored.publicKey) throw new Error('This key doesn’t match your account');
  return { privateKey, publicKey };
}

// ── Passkeys ─────────────────────────────────────────────────────────────────
// A passkey's PRF extension gives a secret that only that passkey, on this
// site, can produce. It locks a copy of the private key, so a new device can
// unlock with the passkey instead of typing the recovery phrase.

/** What the passkey is asked to evaluate (the same for everyone: its output differs per passkey and site). */
export const PRF_SALT = sha256(enc.encode('new.vote sealed prf v1'));

const passkeyKey = (prf: Uint8Array, userId: string) =>
  hkdf(sha256, prf, enc.encode('new.vote sealed v1'), enc.encode(`passkey:${userId}`), 32);

export function lockWithPasskey(id: Identity, prf: Uint8Array, userId: string): string {
  return toB64(seal(passkeyKey(prf, userId), id.privateKey, `passkey-lock:${userId}`));
}

/** The identity back from a passkey lock; throws if it's the wrong passkey or account. */
export function unlockWithPasskey(lock: string, prf: Uint8Array, userId: string, publicKeyB64: string): Identity {
  const privateKey = open(passkeyKey(prf, userId), fromB64(lock), `passkey-lock:${userId}`);
  const publicKey = x25519.getPublicKey(privateKey);
  if (toB64(publicKey) !== publicKeyB64) throw new Error('This key doesn’t match your account');
  return { privateKey, publicKey };
}

// ── Item keys, locked for each member ────────────────────────────────────────

export const newItemKey = () => randomBytes(32);
export const itemAad = (type: string, id: string) => `${type}:${id}`;

/** An item key locked for one member: ephemeral public key (32) | sealed key. */
export function lockFor(memberPublicKey: Uint8Array, itemKey: Uint8Array, aad: string): string {
  const eph = x25519.utils.randomPrivateKey();
  const ephPub = x25519.getPublicKey(eph);
  const shared = x25519.getSharedSecret(eph, memberPublicKey);
  const k = hkdf(sha256, shared, join(ephPub, memberPublicKey), enc.encode('new.vote sealed wrap v1'), 32);
  return toB64(join(ephPub, seal(k, itemKey, `wrap:${aad}`)));
}

export function unlockMine(me: Identity, locked: string, aad: string): Uint8Array {
  const b = fromB64(locked);
  const ephPub = b.subarray(0, 32);
  const shared = x25519.getSharedSecret(me.privateKey, ephPub);
  const k = hkdf(sha256, shared, join(ephPub, me.publicKey), enc.encode('new.vote sealed wrap v1'), 32);
  return open(k, b.subarray(32), `wrap:${aad}`);
}

// ── Text ─────────────────────────────────────────────────────────────────────

export const isSealedText = (v: unknown): v is string => typeof v === 'string' && v.startsWith(PREFIX);

export function sealTextE2E(keys: Map<number, Uint8Array>, epoch: number, text: string, aad: string): string {
  const key = keys.get(epoch);
  if (!key) throw new Error('No key for this item');
  return `${PREFIX}${epoch}:${toB64(seal(key, enc.encode(text), aad))}`;
}

/** The text, or null if this person has no key for it (or it won't open). */
export function openTextE2E(keys: Map<number, Uint8Array>, value: string, aad: string): string | null {
  const m = value.match(/^sn1:(\d+):(.+)$/);
  const key = m ? keys.get(Number(m[1])) : undefined;
  if (!m || !key) return null;
  try { return dec.decode(open(key, fromB64(m[2]), aad)); } catch { return null; }
}

// ── Safety codes ─────────────────────────────────────────────────────────────

/** Five groups of five digits from a public key, for members to compare in person. */
export function safetyCode(publicKeyB64: string): string {
  const h = sha256(fromB64(publicKeyB64));
  const groups: string[] = [];
  for (let i = 0; i < 5; i++) {
    const n = ((h[i * 3] << 16) | (h[i * 3 + 1] << 8) | h[i * 3 + 2]) % 100000;
    groups.push(String(n).padStart(5, '0'));
  }
  return groups.join(' ');
}

// ── Files ────────────────────────────────────────────────────────────────────
// "SN1F" | epoch (4 bytes, big-endian) | nonce (24) | ciphertext, bound to the item.

const FILE_MAGIC = [0x53, 0x4e, 0x31, 0x46]; // "SN1F"
export const isSealedFile = (b: Uint8Array) => b.length > 32 && FILE_MAGIC.every((m, i) => b[i] === m);

export function sealBytes(keys: Map<number, Uint8Array>, epoch: number, data: Uint8Array, aad: string): Uint8Array {
  const key = keys.get(epoch);
  if (!key) throw new Error('No key for this item');
  const head = new Uint8Array(8);
  head.set(FILE_MAGIC, 0);
  new DataView(head.buffer).setUint32(4, epoch);
  return join(head, seal(key, data, aad));
}

/** The file's bytes, or null without the right key (or if it won't open). */
export function openBytes(keys: Map<number, Uint8Array>, data: Uint8Array, aad: string): Uint8Array | null {
  if (!isSealedFile(data)) return null;
  const key = keys.get(new DataView(data.buffer, data.byteOffset).getUint32(4));
  if (!key) return null;
  try { return open(key, data.subarray(8), aad); } catch { return null; }
}
