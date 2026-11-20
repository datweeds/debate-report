// Private share links: a document encrypted in the sharer's browser with a new
// random key that only the link carries, after '#' (browsers never send that
// part to the server). The recipient's browser opens it. Pure functions, used
// by the browser; the server only checks the format.
//
//   copy   "SNS1" | nonce (24) | XChaCha20-Poly1305 of
//          length of details (4, big-endian) | details JSON { name, type, title } | file bytes

import { randomBytes } from '@noble/ciphers/webcrypto';
import { open, seal } from './core';

const MAGIC = [0x53, 0x4e, 0x53, 0x31]; // "SNS1"
const AAD = 'share:v1';
const enc = new TextEncoder(), dec = new TextDecoder();

export type SharedDetails = { name: string; type: string; title: string };

export const isShareCopy = (b: Uint8Array) => b.length > 4 + 24 + 16 && MAGIC.every((m, i) => b[i] === m);

const toB64url = (b: Uint8Array) => {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};

/** Encrypt a document for a private link: the copy to upload, and the key for the link. */
export function makeShareCopy(file: Uint8Array, details: SharedDetails): { copy: Uint8Array; key: string } {
  const key = randomBytes(32);
  const head = enc.encode(JSON.stringify(details));
  const plain = new Uint8Array(4 + head.length + file.length);
  new DataView(plain.buffer).setUint32(0, head.length);
  plain.set(head, 4); plain.set(file, 4 + head.length);
  const box = seal(key, plain, AAD);
  const copy = new Uint8Array(4 + box.length);
  copy.set(MAGIC); copy.set(box, 4);
  return { copy, key: toB64url(key) };
}

/** Open a private link's copy with the key from the link. Throws if the key is wrong. */
export function openShareCopy(copy: Uint8Array, key: string): { details: SharedDetails; file: Uint8Array } {
  if (!isShareCopy(copy)) throw new Error('Not a shared document');
  const k = fromB64url(key.trim());
  if (k.length !== 32) throw new Error('That key isn’t complete');
  const plain = open(k, copy.subarray(4), AAD);
  const n = new DataView(plain.buffer, plain.byteOffset).getUint32(0);
  return { details: JSON.parse(dec.decode(plain.subarray(4, 4 + n))), file: plain.subarray(4 + n) };
}
