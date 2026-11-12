// Public Forum debate structure rules — the single source of truth for which
// statement types may attach to which parent type. Shared by the internal
// (session-authed) and external (API-token-authed) statement-creation routes
// so the two can't silently drift apart.

export const VALID_STAT_TYPES = ['framework', 'claim', 'warrant', 'evidence', 'impact', 'rebuttal', 'turn'] as const;
export type StatType = typeof VALID_STAT_TYPES[number];

export const PF_ALLOWED_CHILDREN: Record<string, string[]> = {
  resolution: ['framework', 'claim'],
  framework:  ['warrant', 'evidence', 'rebuttal'],
  claim:      ['warrant', 'evidence', 'impact', 'rebuttal'],
  warrant:    ['evidence', 'rebuttal'],
  evidence:   ['rebuttal'],
  impact:     ['warrant', 'evidence', 'rebuttal'],
  rebuttal:   ['warrant', 'evidence', 'turn', 'rebuttal'],
  turn:       ['warrant', 'evidence', 'rebuttal'],
};

export function isValidStatType(t: string): t is StatType {
  return (VALID_STAT_TYPES as readonly string[]).includes(t);
}
