// Societies' topics: the same list as debates' topics (components/chamber/constants.ts).
import { SUBJECT_LABELS } from '@/components/chamber/constants';

export const TOPIC_KEYS = Object.keys(SUBJECT_LABELS);
export const MAX_SOCIETY_TOPICS = 3;

/** The valid topics from a request (no repeats, at most 3), or undefined if it isn't a list. */
export function readTopics(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return [...new Set(v.filter((t): t is string => typeof t === 'string' && TOPIC_KEYS.includes(t)))].slice(0, MAX_SOCIETY_TOPICS);
}
