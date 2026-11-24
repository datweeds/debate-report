// The cryptography the wallet verifier (@owf/mdoc) needs, on Node: hashes,
// HPKE (to open the wallet's encrypted answer), COSE signatures and X.509 chains.
// Server-only.
import crypto, { X509Certificate } from 'node:crypto';
import { p256 } from '@noble/curves/p256';
import { p384 } from '@noble/curves/p384';
import { p521 } from '@noble/curves/p521';
import { AEAD_AES_128_GCM, CipherSuite, KDF_HKDF_SHA256, KEM_DHKEM_P256_HKDF_SHA256 } from 'hpke';
import { CoseKey, HpkeSuiteId, type MdocContext } from '@owf/mdoc';

const suite = new CipherSuite(KEM_DHKEM_P256_HKDF_SHA256, KDF_HKDF_SHA256, AEAD_AES_128_GCM);
const curveOf = (k: CoseKey) => {
  const c = String(k.jwk.crv ?? 'P-256');
  return c === 'P-384' ? { curve: p384, hash: 'sha384' } : c === 'P-521' ? { curve: p521, hash: 'sha512' } : { curve: p256, hash: 'sha256' };
};
const u8 = (b: ArrayBuffer | Uint8Array) => new Uint8Array(b);

function verifyChain(trusted: Uint8Array[], x5chain: Uint8Array[], now = new Date()): Uint8Array[] {
  // RFC 5280-style checks for the short chains mDL uses: document signer → issuing authority (IACA) root.
  if (!x5chain.length) throw new Error('Empty certificate chain');
  const chain = x5chain.map(c => new X509Certificate(Buffer.from(c)));
  // Only certificate authorities can be trust anchors (never a document signer itself)
  const anchors = trusted.map(c => new X509Certificate(Buffer.from(c))).filter(c => c.ca);
  const valid = (c: X509Certificate) => now >= new Date(c.validFrom) && now <= new Date(c.validTo);
  const path: X509Certificate[] = [];
  let cur = chain[0];
  for (let depth = 0; depth < 4; depth++) {
    if (!valid(cur)) throw new Error(`Certificate ${cur.subject} is not valid now`);
    path.push(cur);
    const anchor = anchors.find(a => a.fingerprint256 === cur.fingerprint256);
    if (anchor) return path.map(c => u8(c.raw));                    // the chain reaches a trusted root
    const issuer = [...anchors, ...chain].find(a => a.fingerprint256 !== cur.fingerprint256 && cur.checkIssued(a) && cur.verify(a.publicKey));
    if (!issuer) throw new Error(`No trusted issuer for ${cur.subject}`);
    if (!issuer.ca) throw new Error(`${issuer.subject} is not a certificate authority`);
    if (anchors.some(a => a.fingerprint256 === issuer.fingerprint256)) {
      if (!valid(issuer)) throw new Error(`Trusted root ${issuer.subject} is not valid now`);
      path.push(issuer);
      return path.map(c => u8(c.raw));
    }
    cur = issuer;
  }
  throw new Error('Certificate chain too long');
}

export const mdocContext: MdocContext = {
  fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }),
  crypto: {
    random: (n: number) => u8(crypto.randomBytes(n)),
    digest: ({ digestAlgorithm, bytes }) => u8(crypto.createHash(String(digestAlgorithm).replace('-', '').toLowerCase()).update(bytes).digest()),
    hdkf: ({ privateKey, publicKey, salt, info }) => {
      const shared = p256.getSharedSecret(privateKey, publicKey, true).slice(1);
      return u8(crypto.hkdfSync('sha256', shared, salt, info, 32));
    },
    hpke: {
      suites: [HpkeSuiteId.DhkemP256HkdfSha256HkdfSha256Aes128Gcm],
      seal: async ({ recipientPublicKey, info, aad, plaintext }) => {
        const pk = await suite.DeserializePublicKey(recipientPublicKey.publicKey);
        const { encapsulatedSecret, ciphertext } = await suite.Seal(pk, plaintext, { info, aad });
        return { enc: u8(encapsulatedSecret), ciphertext: u8(ciphertext) };
      },
      open: async ({ recipientKey, enc, info, aad, ciphertext }) => {
        const [privateKey, publicKey] = await Promise.all([suite.DeserializePrivateKey(recipientKey.d as Uint8Array), suite.DeserializePublicKey(recipientKey.publicKey)]);
        return u8(await suite.Open({ privateKey, publicKey }, enc, ciphertext, { info, aad }));
      },
    },
  },
  cose: {
    sign1: {
      sign: async ({ key, toBeSigned }) => {
        const { curve, hash } = curveOf(key);
        return curve.sign(u8(crypto.createHash(hash).update(toBeSigned).digest()), key.d as Uint8Array, { prehash: false }).toCompactRawBytes();
      },
      verify: async ({ signature, key, toBeVerified }) => {
        const { curve, hash } = curveOf(key);
        return curve.verify(signature, u8(crypto.createHash(hash).update(toBeVerified).digest()), key.publicKey, { prehash: false, lowS: false });
      },
    },
    mac0: {
      authenticate: async ({ key, toBeAuthenticated }) =>
        u8(crypto.createHmac('sha256', key instanceof CoseKey ? (key.k as Uint8Array) : key).update(toBeAuthenticated).digest()),
      verify: async ({ key, toBeAuthenticated, tag }) => {
        const mac = crypto.createHmac('sha256', key instanceof CoseKey ? (key.k as Uint8Array) : key).update(toBeAuthenticated).digest();
        return mac.length === tag.length && crypto.timingSafeEqual(mac, Buffer.from(tag));
      },
    },
  },
  x509: {
    getSubjectNameField: ({ certificate, field }) =>
      new X509Certificate(Buffer.from(certificate)).subject.split('\n').filter(l => l.startsWith(field + '=')).map(l => l.slice(field.length + 1)),
    getPublicKey: async ({ certificate }) =>
      CoseKey.fromJwk(new X509Certificate(Buffer.from(certificate)).publicKey.export({ format: 'jwk' }) as Record<string, unknown>),
    verifyCertificateChain: ({ trustedCertificates, x5chain, now }) => ({ chain: verifyChain(trustedCertificates, x5chain, now) }),
    getCertificateData: ({ certificate }) => {
      const c = new X509Certificate(Buffer.from(certificate));
      return { issuerName: c.issuer.replace(/\n/g, ', '), subjectName: c.subject.replace(/\n/g, ', '), serialNumber: c.serialNumber,
        thumbprint: c.fingerprint256.replace(/:/g, '').toLowerCase(), notBefore: new Date(c.validFrom), notAfter: new Date(c.validTo), pem: c.toString() };
    },
  },
};
