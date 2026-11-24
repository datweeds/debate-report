'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AreaFilterControl from '@/components/areas/AreaFilterControl';
import { matchIds, useAreaIndex, useMyArea, type AreaFilter } from '@/components/areas/myArea';
import { AreaLabel, CardStats, PrivacyBadge, TOPIC_OPTIONS, TopicLozenge, topicLabel, useSocietySearch, useTopicCounts, type Kind } from './societyFind';

// Find a Society: search as you type, by topic, public or private. Public and
// Apply Societies are listed to everyone; Invite ones only to their members.
export default function SocietyBrowser({ onClose, initial }: {
  onClose: () => void; initial?: { q?: string; topic?: string; kind?: Kind; area?: AreaFilter };
}) {
  const [q, setQ] = useState(initial?.q ?? '');
  const [topic, setTopic] = useState(initial?.topic ?? '');
  const [kind, setKind] = useState<Kind>(initial?.kind ?? 'all');
  const areaIdx = useAreaIndex();
  const mine = useMyArea();
  const [area, setArea] = useState<AreaFilter>(initial?.area ?? { mode: 'any' });
  const ids = matchIds(areaIdx, area, mine);
  const { list, more, loading, error, loadMore } = useSocietySearch({ q, topic, kind, ids });
  const counts = useTopicCounts();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => input.current?.focus(), 50); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  const field = 'w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-950/55" />
      <div role="dialog" aria-modal="true" aria-labelledby="society-browser-h" onClick={e => e.stopPropagation()}
        className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-700 bg-dr-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 id="society-browser-h" className="text-base font-semibold text-slate-100">Find a Society</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-lg leading-none text-slate-500 hover:bg-slate-800 hover:text-slate-300">×</button>
        </div>
        <div className="space-y-2 border-b border-slate-800 px-5 py-3">
          <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or description…" aria-label="Search Societies" className={field} />
          {areaIdx?.adult && <AreaFilterControl value={area} onChange={setArea} mine={mine} onNavigate={onClose} />}
          <div className="flex flex-wrap gap-2">
            <select value={topic} onChange={e => setTopic(e.target.value)} aria-label="Topic" className={`${field} w-auto flex-1 text-slate-300`}>
              <option value="">All topics</option>
              {TOPIC_OPTIONS.map(t => <option key={t.key} value={t.key}>{topicLabel(t.label, t.key, counts)}</option>)}
            </select>
            <div className="flex rounded-lg border border-slate-700 p-0.5 text-xs" role="group" aria-label="Public or private">
              {(['all', 'public', 'private'] as const).map(k => (
                <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
                  className={`rounded-md px-3 py-1.5 ${kind === k ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                  {k === 'all' ? 'All' : k === 'public' ? 'Public' : 'Private'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto" aria-live="polite">
          {error ? <p className="py-10 text-center text-sm text-rose-400">Couldn’t load Societies. Please try again.</p>
          : !list.length ? (
            <p className="py-10 text-center text-sm text-slate-500">
              {loading ? 'Searching…' : q || topic ? 'No Societies match. Try other words or another topic.' : 'No Societies yet.'}
            </p>
          ) : (
            <ul>
              {list.map(s => (
                <li key={s.id}>
                  <Link href={`/society/${s.slug || s.id}/about`} onClick={onClose}
                    className="block border-b border-slate-800/60 px-5 py-3.5 hover:bg-slate-800/50">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-100">{s.name}</span>
                      <PrivacyBadge s={s} />
                      {s.topics.map(t => <TopicLozenge key={t} topic={t} />)}
                    </span>
                    {s.description && <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-slate-500">{s.description}</span>}
                    <span className="mt-1 flex flex-wrap gap-x-3"><CardStats s={s} /><AreaLabel area={s.area} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {more && (
            <div className="p-3 text-center">
              <button type="button" onClick={loadMore} disabled={loading} className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50">
                {loading ? 'Loading…' : 'Show more'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
