'use client';

import { useEffect, useState } from 'react';
import { SUBJECT_COLOURS, SUBJECT_LABELS } from '@/components/chamber/constants';
import { LockIcon } from './SocietyIcons';

export type SocietyCard = {
  id: number; name: string; slug: string | null; description: string | null;
  visibility: 'public' | 'apply' | 'invite'; isMember: boolean; topics: string[]; disabled: string[];
  members: number; lastActivity: string | null;
  area?: { label: string; level: string } | null;   // adults only
};
export type Kind = 'all' | 'public' | 'private';
export const TOPIC_OPTIONS = Object.entries(SUBJECT_LABELS).map(([key, label]) => ({ key, label }));

/** Societies per topic (for "Politics (3)"); null until loaded. Refetched when `key` changes (e.g. login). */
export function useTopicCounts(key?: unknown): Record<string, number> | null {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let live = true;
    fetch('/api/societies/topics').then(r => r.ok ? r.json() : null)
      .then(d => { if (live) setCounts(d?.counts ?? {}); }).catch(() => { if (live) setCounts({}); });
    return () => { live = false; };
  }, [key]);
  return counts;
}
export const topicLabel = (label: string, key: string, counts: Record<string, number> | null) =>
  counts ? `${label} (${counts[key] ?? 0})` : label;

/** "Last active 3 Nov 2026" */
export const fmtActive = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

/** "12 members · active 3 Nov 2026" */
export function CardStats({ s }: { s: Pick<SocietyCard, 'members' | 'lastActivity'> }) {
  const active = fmtActive(s.lastActivity);
  return (
    <span className="text-[11px] text-slate-500">
      {s.members} member{s.members === 1 ? '' : 's'}{active ? ` · last active ${active}` : ' · no activity yet'}
    </span>
  );
}

/** An adult-only Area label: "📍 Norwich, Norfolk" */
export function AreaLabel({ area }: { area?: { label: string } | null }) {
  if (!area) return null;
  return <span className="text-[11px] text-emerald-300/90" title="Area this Society covers">📍 {area.label}</span>;
}

export function TopicLozenge({ topic }: { topic: string }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${SUBJECT_COLOURS[topic] ?? 'border-slate-600 bg-slate-700 text-slate-400'}`}>
      {SUBJECT_LABELS[topic] ?? topic}
    </span>
  );
}

export function PrivacyBadge({ s }: { s: Pick<SocietyCard, 'visibility' | 'isMember'> }) {
  if (s.visibility === 'public') return null;
  return (
    <span className="inline-flex items-center gap-1 rounded border border-slate-700/60 bg-slate-700/50 px-1.5 py-0.5 text-[10px] text-slate-400">
      <span className="text-amber-300"><LockIcon className="h-2.5 w-2.5" /></span>{s.isMember ? 'Member' : s.visibility === 'apply' ? 'Apply to join' : 'Invite only'}
    </span>
  );
}

/** Societies matching the search, fetched as the person types (a short pause between keys). */
export function useSocietySearch({ q, topic, kind, limit = 20, enabled = true, ids = null }: {
  q: string; topic: string; kind: Kind; limit?: number; enabled?: boolean;
  ids?: number[] | null;   // only these (area matching on this device); sent in a POST body
}) {
  const idsKey = ids ? ids.join(',') : '';
  const [state, setState] = useState<{ list: SocietyCard[]; more: boolean; loading: boolean; error: boolean }>({ list: [], more: false, loading: false, error: false });
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [q, topic, kind, idsKey]);
  useEffect(() => {
    if (!enabled) { setState({ list: [], more: false, loading: false, error: false }); return; }
    let live = true;
    setState(s => ({ ...s, loading: true, error: false }));
    const t = setTimeout(() => {
      const body = { q: q.trim(), kind, limit, offset: page * limit, topic: topic || undefined, ids: ids ?? undefined };
      (ids && !ids.length ? Promise.resolve({ ok: true, json: async () => ({ societies: [], more: false }) } as Response)
        : fetch('/api/societies/browse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
        .then(r => r.ok ? r.json() : Promise.reject())
        .then((d: { societies: SocietyCard[]; more: boolean }) => {
          if (!live) return;
          setState(s => ({ list: page ? [...s.list, ...d.societies] : d.societies, more: d.more, loading: false, error: false }));
        })
        .catch(() => { if (live) setState(s => ({ ...s, loading: false, error: true })); });
    }, page ? 0 : 200);
    return () => { live = false; clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, topic, kind, limit, page, enabled, idsKey]);
  return { ...state, loadMore: () => setPage(p => p + 1) };
}
