// Trusted issuers for wallet proofs: the root certificates (IACAs) of the
// authorities whose credentials we accept, as PEM files in AGE_TRUST_DIR
// (default ~/data/age-trust). We trust the issuer, not the wallet app.
// Add a file and it's used straight away (re-read every 10 minutes). Server-only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { X509Certificate } from 'node:crypto';

export const TRUST_DIR = process.env.AGE_TRUST_DIR ?? path.join(os.homedir(), 'data', 'age-trust');
let cache: { at: number; certs: { der: Uint8Array; subject: string; file: string; validTo: string }[] } | null = null;

export function trustedIssuers() {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.certs;
  const certs: { der: Uint8Array; subject: string; file: string; validTo: string }[] = [];
  try {
    for (const f of fs.readdirSync(TRUST_DIR).filter(f => /\.(pem|crt|cer)$/i.test(f)).sort()) {
      const text = fs.readFileSync(path.join(TRUST_DIR, f), 'utf8');
      for (const block of text.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? []) {
        try {
          const c = new X509Certificate(block);
          if (c.ca) certs.push({ der: new Uint8Array(c.raw), subject: c.subject.replace(/\n/g, ', '), file: f, validTo: c.validTo });
        } catch { /* not a certificate */ }
      }
    }
  } catch { /* no folder yet */ }
  cache = { at: Date.now(), certs };
  return certs;
}
export const forgetTrustCache = () => { cache = null; };
