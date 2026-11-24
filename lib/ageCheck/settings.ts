// Age check settings, changed by a Sys Admin (Admin → Privacy → Age checks).
import { getSetting, setSetting } from '../siteSettings';

export type AgeCheckSettings = {
  enabled: boolean;        // checks are offered and required where the rules say
  wallet: boolean;         // offer the wallet proof (verified on our own server)
  faceProvider: string;    // id of the face-check provider (lib/ageCheck/providers.ts), or 'none'
  challenge16: number;     // a face estimate must be at least this to count as 16+
  challenge18: number;     // … and this to count as 18+ (agree both with the provider)
};
export const DEFAULTS: AgeCheckSettings = { enabled: false, wallet: true, faceProvider: 'none', challenge16: 19, challenge18: 21 };

export async function ageCheckSettings(): Promise<AgeCheckSettings> {
  return { ...DEFAULTS, ...(await getSetting<Partial<AgeCheckSettings>>('age_checks', {})) };
}
export async function saveAgeCheckSettings(v: Partial<AgeCheckSettings>, by: string) {
  const cur = await ageCheckSettings();
  const next: AgeCheckSettings = {
    enabled: typeof v.enabled === 'boolean' ? v.enabled : cur.enabled,
    wallet: typeof v.wallet === 'boolean' ? v.wallet : cur.wallet,
    faceProvider: typeof v.faceProvider === 'string' ? v.faceProvider.slice(0, 40) : cur.faceProvider,
    challenge16: Number.isInteger(v.challenge16) && v.challenge16! >= 16 && v.challenge16! <= 30 ? v.challenge16! : cur.challenge16,
    challenge18: Number.isInteger(v.challenge18) && v.challenge18! >= 18 && v.challenge18! <= 35 ? v.challenge18! : cur.challenge18,
  };
  await setSetting('age_checks', next, by);
  return next;
}
