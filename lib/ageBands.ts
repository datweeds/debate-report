// Age bands, safe to import in the browser (no database).
export const AGE_BANDS = ['13-15', '16-17', '18+'] as const;
export type AgeBand = typeof AGE_BANDS[number];
export const AGE_LABELS: Record<AgeBand, string> = { '13-15': '13 to 15', '16-17': '16 or 17', '18+': '18 or over' };
export const isAgeBand = (v: unknown): v is AgeBand => typeof v === 'string' && (AGE_BANDS as readonly string[]).includes(v);
export const isUnder18 = (b: string | null | undefined) => b === '13-15' || b === '16-17';
export const isUnder16 = (b: string | null | undefined) => b === '13-15';
/** Move up a band as you grow up, never down: an adult can't pass as a child to reach youth groups. */
export function mayChangeBand(from: AgeBand | null, to: AgeBand): boolean {
  return from == null || AGE_BANDS.indexOf(to) >= AGE_BANDS.indexOf(from);
}
