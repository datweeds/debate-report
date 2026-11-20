// The features a Society can switch on or off (shared by server and browser).
// "About" is always on. Stored as the switched-off keys (customers.disabled_sections).

export const FEATURES = [
  { key: 'debates',     slug: '',            label: 'Debate',      blurb: 'Structured debates: arguments, evidence and votes, mapped visually.' },
  { key: 'polls',       slug: 'polls',       label: 'Polls',       blurb: 'Secret or named ballots, ranked-choice votes, ratings and quizzes.' },
  { key: 'news',        slug: 'news',        label: 'News',        blurb: 'A magazine of news on the Society’s topics, from many sources.' },
  { key: 'discussions', slug: 'discussions', label: 'Discussions', blurb: 'Members-only discussion threads.' },
  { key: 'meet',        slug: 'meet',        label: 'Meet',        blurb: 'Audio and video rooms, optionally end-to-end encrypted.' },
  { key: 'documents',   slug: 'documents',   label: 'Documents',   blurb: 'Shared files and links, in folders.' },
  { key: 'events',      slug: 'events',      label: 'Events',      blurb: 'A calendar of the Society’s events.' },
  { key: 'projects',    slug: 'projects',    label: 'Projects',    blurb: 'Projects with tasks, status reports and risk logs.' },
  { key: 'principles',  slug: 'principles',  label: 'Principles',  blurb: 'The rules and aspirations the Society runs by, in versions.' },
] as const;

export type FeatureKey = typeof FEATURES[number]['key'];
export const FEATURE_KEYS = FEATURES.map(f => f.key) as readonly FeatureKey[];
export const featureBySlug = (slug: string) => FEATURES.find(f => f.slug === slug);

/** Which feature a Society API path belongs to: /api/societies/<id>/<segment>/… */
const API_SEGMENTS: Record<string, FeatureKey> = {
  threads: 'discussions', posts: 'discussions',
  documents: 'documents', folders: 'documents',
  events: 'events', projects: 'projects', principles: 'principles',
  polls: 'polls', rtc: 'meet', news: 'news',
};
export function featureOfApiPath(pathname: string): FeatureKey | null {
  const m = pathname.match(/^\/api\/societies\/[^/]+\/([^/]+)/);
  return m ? API_SEGMENTS[m[1]] ?? null : null;
}

/** Keep only known feature keys (for saving). */
export const cleanFeatures = (v: unknown): FeatureKey[] =>
  Array.isArray(v) ? [...new Set(v.filter((k): k is FeatureKey => (FEATURE_KEYS as readonly string[]).includes(k)))] : [];
