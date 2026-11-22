import { NextRequest, NextResponse } from 'next/server';
import { societyContentAccess } from '@/lib/societies';
import { loadSocietyAi } from '@/lib/ai/gateway';
import { listModels, ProviderError } from '@/lib/ai/providers';
import { providerAddress } from '@/lib/ai/societySettings';
import { decryptSecret } from '@/lib/ai/secrets';

// POST { preset, base_url?, api_key? } — the models a provider offers, so the
// admin can pick from them. Uses the stored key if none is given. Moderators.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Society Admins only' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  try {
    const { preset, baseUrl } = await providerAddress(b.preset, b.base_url);
    let key: string | null = typeof b.api_key === 'string' && b.api_key.trim() ? b.api_key.trim() : null;
    if (!key) {
      const stored = await loadSocietyAi(a.societyId);
      if (stored?.preset === preset.id && stored.secret_enc) key = decryptSecret(stored.secret_enc);
    }
    if (preset.keyRequired && !key) return NextResponse.json({ error: 'Enter the API key first' }, { status: 400 });
    return NextResponse.json({ models: await listModels({ adapter: preset.adapter, baseUrl, apiKey: key }) });
  } catch (err) {
    if (err instanceof ProviderError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
