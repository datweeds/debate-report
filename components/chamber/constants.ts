export const SUBJECT_LABELS: Record<string, string> = {
  culture: 'Culture', economics: 'Economics', education: 'Education',
  environment: 'Environment & Energy', future: 'Future', health: 'Health',
  history: 'History', law: 'Law', media: 'Media',
  philosophy: 'Philosophy', politics: 'Politics', science: 'Science',
};

export const SUBJECT_COLOURS: Record<string, string> = {
  culture:     'bg-pink-500/15 text-pink-300 border-pink-500/30',
  economics:   'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  education:   'bg-sky-500/15 text-sky-300 border-sky-500/30',
  environment: 'bg-green-500/15 text-green-300 border-green-500/30',
  future:      'bg-violet-500/15 text-violet-300 border-violet-500/30',
  health:      'bg-rose-500/15 text-rose-300 border-rose-500/30',
  history:     'bg-amber-500/15 text-amber-300 border-amber-500/30',
  law:         'bg-slate-500/15 text-slate-300 border-slate-500/30',
  media:       'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  philosophy:  'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  politics:    'bg-blue-500/15 text-blue-300 border-blue-500/30',
  science:     'bg-teal-500/15 text-teal-300 border-teal-500/30',
};

export const STAT_BADGE: Record<string, string> = {
  resolution: 'bg-amber-400/20 text-amber-200 border-amber-500/40',
  framework:  'bg-sky-500/20 text-sky-200 border-sky-500/40',
  claim:      'bg-slate-500/30 text-slate-200 border-slate-400/30',
  warrant:    'bg-violet-500/20 text-violet-200 border-violet-500/40',
  evidence:   'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
  impact:     'bg-orange-500/20 text-orange-200 border-orange-500/40',
  rebuttal:   'bg-rose-500/20 text-rose-200 border-rose-500/40',
  turn:       'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/40',
};

export const STAT_LABEL: Record<string, string> = {
  resolution: 'Resolution', framework: 'Framework', claim: 'Claim',
  warrant:    'Warrant',    evidence:  'Evidence',  impact: 'Impact',
  rebuttal:   'Rebuttal',   turn:      'Turn',
};

// ── Public Forum debate connection rules ──────────────────────────────────────
// Maps each statement type to the child types that can be added to it.
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

// ── Direction rules per statement type ───────────────────────────────────────
// null  → neutral (no direction field shown)
// 'against' → auto-set, user cannot change
// 'user' → user picks For / Against
export type DirectionMode = 'neutral' | 'auto-against' | 'user';

export const TYPE_DIRECTION_MODE: Record<string, DirectionMode> = {
  resolution: 'neutral',
  framework:  'neutral',
  claim:      'user',
  warrant:    'user',
  evidence:   'neutral',
  impact:     'user',
  rebuttal:   'auto-against',  // always challenges the parent
  turn:       'user',          // depends on whose turn — debater picks
};
