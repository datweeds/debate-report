// Checking and saving a Society's AI settings. Server-only.

import pool from '@/lib/db';
import { encryptSecret } from './secrets';
import { checkEndpoint, localEndpointsAllowed, ProviderError } from './providers';
import { presetById } from './presets';
import { loadSocietyAi } from './gateway';

export type AiSettingsInput = {
  mode?: string; preset?: string | null; base_url?: string | null;
  model_light?: string | null; model_standard?: string | null;
  light_in_usd?: number; light_out_usd?: number; standard_in_usd?: number; standard_out_usd?: number;
  monthly_budget_usd?: number | null; api_key?: string | null; clear_key?: boolean;
};

const price = (v: unknown) => Math.max(0, Math.min(1000, Number(v) || 0));
const modelName = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 200) : '') || null;

// Resolve the provider's address: the preset's, or the one entered
export async function providerAddress(presetId: string | null | undefined, entered: string | null | undefined) {
  const preset = presetById(presetId);
  if (!preset) throw new ProviderError('Choose a provider');
  if (preset.local && !localEndpointsAllowed()) throw new ProviderError('Models on this server can only be used on self-hosted installs');
  const baseUrl = preset.adapter === 'anthropic' ? null : (preset.baseUrl && !preset.local ? preset.baseUrl : (entered?.trim() || preset.baseUrl));
  if (preset.adapter !== 'anthropic' && !baseUrl) throw new ProviderError('Enter the provider’s base URL');
  if (baseUrl && preset.id === 'custom') await checkEndpoint(baseUrl);
  return { preset, baseUrl };
}

export async function saveAiSettings(societyId: number, userId: string, b: AiSettingsInput): Promise<void> {
  const mode = b.mode === 'own' || b.mode === 'off' ? b.mode : 'platform';
  const current = await loadSocietyAi(societyId);
  let preset = current?.preset ?? null, adapter = current?.adapter ?? null, baseUrl = current?.base_url ?? null;
  let secret = current?.secret_enc ?? null;
  const modelLight = b.model_light !== undefined ? modelName(b.model_light) : current?.model_light ?? null;
  const modelStandard = b.model_standard !== undefined ? modelName(b.model_standard) : current?.model_standard ?? null;

  if (b.preset !== undefined || mode === 'own') {
    const addr = await providerAddress(b.preset ?? preset, b.base_url ?? baseUrl);
    if (addr.preset.id !== preset) secret = null;  // a key belongs to one provider
    preset = addr.preset.id; adapter = addr.preset.adapter; baseUrl = addr.baseUrl;
  }
  if (b.clear_key) secret = null;
  if (b.api_key?.trim()) secret = encryptSecret(b.api_key.trim());
  if (mode === 'own') {
    if (!modelStandard && !modelLight) throw new ProviderError('Choose at least the model for writing and reviewing');
    if (presetById(preset)?.keyRequired && !secret) throw new ProviderError('Enter the API key');
  }
  const budget = b.monthly_budget_usd === null || b.monthly_budget_usd === undefined || String(b.monthly_budget_usd) === ''
    ? null : Math.max(0, Math.min(100000, Number(b.monthly_budget_usd)));

  await pool.query(
    `INSERT INTO society_ai (customer_id, mode, preset, adapter, base_url, model_light, model_standard, secret_enc,
       light_in_usd, light_out_usd, standard_in_usd, standard_out_usd, monthly_budget_usd, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (customer_id) DO UPDATE SET mode = $2, preset = $3, adapter = $4, base_url = $5, model_light = $6,
       model_standard = $7, secret_enc = $8, light_in_usd = $9, light_out_usd = $10, standard_in_usd = $11,
       standard_out_usd = $12, monthly_budget_usd = $13, updated_by = $14, updated_at = now()`,
    [societyId, mode, preset, adapter, baseUrl, modelLight, modelStandard, secret,
     price(b.light_in_usd ?? current?.light_in_usd), price(b.light_out_usd ?? current?.light_out_usd),
     price(b.standard_in_usd ?? current?.standard_in_usd), price(b.standard_out_usd ?? current?.standard_out_usd),
     b.monthly_budget_usd !== undefined ? budget : current?.monthly_budget_usd ?? null, userId],
  );
}

// What the browser may see: never the key
export function publicAiSettings(s: Awaited<ReturnType<typeof loadSocietyAi>>) {
  if (!s) return { mode: 'platform', preset: null, base_url: null, model_light: null, model_standard: null, has_key: false,
    light_in_usd: 0, light_out_usd: 0, standard_in_usd: 0, standard_out_usd: 0, monthly_budget_usd: null, last_test: null };
  const { secret_enc, customer_id: _c, adapter: _a, updated_at: _u, ...rest } = s;
  return { ...rest, has_key: !!secret_enc };
}
