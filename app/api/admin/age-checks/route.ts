import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { ageCheckSettings, saveAgeCheckSettings } from '@/lib/ageCheck/settings';
import { PROVIDERS } from '@/lib/ageCheck/providers';
import { TRUST_DIR, trustedIssuers, forgetTrustCache } from '@/lib/ageCheck/trust';

// GET/PATCH — age check settings (Sys Admin): on/off, wallet, the face-check
// provider and challenge ages; and the trusted wallet issuers found on the server.
export async function GET(req: NextRequest) {
  const s = await getSessionFromRequest(req);
  if (!s?.isSysAdmin) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  forgetTrustCache();
  return NextResponse.json({
    settings: await ageCheckSettings(),
    providers: [{ id: 'none', label: 'None', ready: true }, ...PROVIDERS.map(p => ({ id: p.id, label: p.label, ready: p.ready() }))],
    trust: { dir: TRUST_DIR, issuers: trustedIssuers().map(t => ({ subject: t.subject, file: t.file, validTo: t.validTo })) },
  });
}
export async function PATCH(req: NextRequest) {
  const s = await getSessionFromRequest(req);
  if (!s?.isSysAdmin) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ settings: await saveAgeCheckSettings(await req.json().catch(() => ({})), s.sub) });
}
