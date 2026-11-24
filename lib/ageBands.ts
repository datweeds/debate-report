// Age bands, safe to import in the browser (no database). new.vote is 16+.
export const AGE_BANDS = ['16-17', '18+'] as const;
export type AgeBand = typeof AGE_BANDS[number];
export const AGE_LABELS: Record<AgeBand, string> = { '16-17': '16 or 17', '18+': '18 or over' };
/** The sign-up and profile choice that means "too young": never stored as a band. */
export const UNDER_16 = 'under-16';
export const isAgeBand = (v: unknown): v is AgeBand => typeof v === 'string' && (AGE_BANDS as readonly string[]).includes(v);
export const isUnder18 = (b: string | null | undefined) => b === '16-17';
