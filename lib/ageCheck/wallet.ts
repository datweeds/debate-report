// Wallet proof: the browser asks the member's wallet (Digital Credentials API,
// protocol "org-iso-mdoc", ISO/IEC TS 18013-7 Annex C) for "age over 16" and
// "age over 18" from a mobile driving licence or an EU-style age credential.
// The answer comes back encrypted to a one-time key, and we check it here:
// the issuer's signature against our trusted issuers, that it belongs to the
// device presenting it, that it answers this request (one-time nonce, bound to
// our web address), and that it isn't expired or revoked. No age-check company
// is involved. We learn only yes/no answers. Server-only.
import { CoseKey, DeviceRequest, IsoMdocDcApi } from '@owf/mdoc';
import { p256 } from '@noble/curves/p256';
import { mdocContext } from './mdocContext';
import { trustedIssuers } from './trust';

export const PROTOCOL = 'org-iso-mdoc';
const MDL = { docType: 'org.iso.18013.5.1.mDL', ns: 'org.iso.18013.5.1' };
const AV = { docType: 'eu.europa.ec.av.1', ns: 'eu.europa.ec.av.1' };   // EU age verification credential
const b64u = (b: Uint8Array) => Buffer.from(b).toString('base64url');

export type WalletState = { recipientJwk: Record<string, unknown>; encryptionInfo: string; deviceRequest: string; origin: string };

/** A request for the browser to pass to navigator.credentials.get, and what to keep to check the answer. */
export async function createWalletRequest(origin: string): Promise<{ request: { protocol: string; data: unknown }; state: WalletState }> {
  const d = p256.utils.randomPrivateKey();
  const pub = p256.getPublicKey(d, false);
  const jwk = { kty: 'EC', crv: 'P-256', x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33)), d: b64u(d) };
  const { x, y, kty, crv } = jwk;
  const created = await IsoMdocDcApi.createRequest({
    docRequests: [
      { docType: MDL.docType, namespaces: { [MDL.ns]: { age_over_16: false, age_over_18: false } } },
      { docType: AV.docType, namespaces: { [AV.ns]: { age_over_16: false, age_over_18: false } } },
    ],
    // Either credential will do: a driving licence or an EU age credential
    deviceRequestInfo: { useCases: [{ mandatory: true, documentSets: [[0], [1]] }] },
    recipientPublicKey: CoseKey.fromJwk({ kty, crv, x, y }),
  }, mdocContext);
  return {
    request: { protocol: PROTOCOL, data: created.request },
    state: { recipientJwk: jwk, encryptionInfo: created.request.encryptionInfo, deviceRequest: created.request.deviceRequest, origin },
  };
}

/** Check the wallet's answer. Returns the age answers it carries, or throws. */
export async function verifyWalletResponse(state: WalletState, response: unknown, opts?: { extraTrust?: Uint8Array[] }) {
  const issuance = [...trustedIssuers().map(t => t.der), ...(opts?.extraTrust ?? [])];
  if (!issuance.length) throw new Error('No trusted issuers are set up yet');
  const { deviceResponse } = await IsoMdocDcApi.verifyResponse({
    response: response as { response: string },
    origin: state.origin,
    encryptionInfo: state.encryptionInfo,
    recipientKey: CoseKey.fromJwk(state.recipientJwk),
    deviceRequest: DeviceRequest.decode(Buffer.from(state.deviceRequest, 'base64url')),
    trustedCertificates: [{ issuance }],
    deviceRequestMatchOptions: { treatAmbiguousMultipleDocRequestsAsAlternatives: true },
  }, mdocContext);
  let over16: boolean | undefined, over18: boolean | undefined;
  for (const doc of deviceResponse.documents ?? []) {
    const ns = doc.docType === AV.docType ? AV.ns : MDL.ns;
    const claims = doc.issuerSigned.getPrettyClaims(ns) as Record<string, unknown> | undefined;
    if (typeof claims?.age_over_18 === 'boolean') over18 = (over18 ?? false) || claims.age_over_18;
    if (typeof claims?.age_over_16 === 'boolean') over16 = (over16 ?? false) || claims.age_over_16;
  }
  if (over18 === true) over16 = true;          // 18+ implies 16+
  if (over18 === undefined && over16 === undefined) throw new Error('The wallet didn’t share an age answer');
  return { over16: over16 ?? false, over18: over18 ?? false };
}
