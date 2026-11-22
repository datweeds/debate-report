'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { type Source, type Story, timeAgo } from './Tiles';

// A story in full: summary, why it matters, every outlet that carried it,
// and what members and moderators can do with it.
export default function StoryModal({ story, societyId, canPost, canModerate, onClose, onChanged }: {
  story: Story; societyId: number; canPost: boolean; canModerate: boolean;
  onClose: () => void; onChanged?: () => void;
}) {
  const [sources, setSources] = useState<Source[]>(story.top_sources);
  const [loadingAll, setLoadingAll] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  async function allCoverage() {
    setLoadingAll(true);
    const r = await fetch(`/api/societies/${societyId}/news/stories/${story.cluster_id}`);
    setLoadingAll(false);
    if (!r.ok) { setMessage('Could not load the coverage.'); return; }
    const d = await r.json();
    setSources((d.sources as (Source & { duplicate: boolean })[]).filter(s => !s.duplicate));
  }

  async function act(body: Record<string, string>, done: string) {
    setBusy(true); setMessage('');
    const r = await fetch(`/api/societies/${societyId}/news/stories/${story.cluster_id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMessage(d.error ?? 'That didn’t work.'); return; }
    setMessage(done);
    if (body.action !== 'feedback') { onChanged?.(); onClose(); }
  }

  const firstUrl = sources.find(s => s.url)?.url;
  const debateHref = `/dashboard/new-debate?society=${societyId}&title=${encodeURIComponent(story.title)}`
    + `&description=${encodeURIComponent(`${story.summary ?? ''}${firstUrl ? `\n\nSource: ${firstUrl}` : ''}`.trim())}`;
  const discussBody = [story.summary, '', ...sources.slice(0, 3).filter(s => s.url).map(s => `${s.outlet}: ${s.url}`)].join('\n').trim();
  const discussHref = `/society/${societyId}/discussions?new=1&title=${encodeURIComponent(story.title)}&body=${encodeURIComponent(discussBody)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8" onClick={onClose}>
      <article className="relative w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-2 text-slate-300 hover:text-white">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        {story.image_url?.startsWith('https://') && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={story.image_url} alt="" referrerPolicy="no-referrer" className="aspect-[2/1] w-full rounded-t-2xl object-cover bg-slate-800"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        )}
        <div className="p-6 sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-400">
            {story.section_heading}{story.is_update && <span className="ml-2 text-amber-300">Update</span>}
          </p>
          <h2 className="mt-2 font-serif text-2xl font-bold leading-tight text-slate-100 sm:text-3xl">{story.title}</h2>
          <p className="mt-2 text-xs text-slate-500">
            {story.source_count} {story.source_count === 1 ? 'source' : 'sources'} · first seen {timeAgo(story.first_seen)} · latest {timeAgo(story.last_activity)}
          </p>

          {story.summary && <p className="mt-5 text-[15px] leading-relaxed text-slate-200">{story.summary}</p>}
          {story.why_it_matters && (
            <div className="mt-5 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-blue-300">Why it matters</p>
              <p className="mt-1 text-sm text-slate-300">{story.why_it_matters}</p>
            </div>
          )}
          {story.editor_note && (
            <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-slate-300">
              <span className="font-semibold text-emerald-300">Editor’s note: </span>{story.editor_note}
            </div>
          )}
          {(story.topics.length > 0 || story.locations.length > 0) && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {story.locations.map(l => <span key={l} className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">📍 {l}</span>)}
              {story.topics.map(t => <span key={t} className="rounded-full bg-slate-800/60 px-2.5 py-1 text-xs text-slate-400">{t}</span>)}
            </div>
          )}

          <h3 className="mt-7 text-xs font-bold uppercase tracking-widest text-slate-400">Coverage</h3>
          <ul className="mt-2 divide-y divide-slate-800/80">
            {sources.map((s, n) => (
              <li key={`${s.url ?? s.title}-${n}`} className="py-2.5">
                <p className="text-xs font-semibold text-slate-400">{s.outlet}{s.published_at && <span className="font-normal text-slate-600"> · {timeAgo(s.published_at)}</span>}</p>
                {s.url
                  ? <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-sm text-blue-300 hover:text-blue-200 hover:underline">{s.title} ↗</a>
                  : <p className="text-sm text-slate-300">{s.title}</p>}
              </li>
            ))}
          </ul>
          {story.source_count > sources.length && (
            <button onClick={allCoverage} disabled={loadingAll} className="mt-2 text-xs text-blue-400 hover:text-blue-300">
              {loadingAll ? 'Loading…' : `Show all ${story.source_count} sources`}
            </button>
          )}

          <div className="mt-7 flex flex-wrap gap-2 border-t border-slate-800 pt-5">
            {canModerate && <Link href={debateHref} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">Start a debate</Link>}
            {canPost && <Link href={discussHref} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">Discuss</Link>}
            {canPost && (
              <>
                <button disabled={busy} onClick={() => act({ action: 'feedback', value: 'useful' }, 'Thanks — noted as useful.')}
                  className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200">👍 Useful</button>
                <button disabled={busy} onClick={() => act({ action: 'feedback', value: 'not_relevant' }, 'Thanks — noted as not relevant.')}
                  className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200">👎 Not relevant</button>
              </>
            )}
          </div>
          {canModerate && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="py-1.5 text-slate-500">Society Admin:</span>
              {!story.is_headline && (
                <button disabled={busy} onClick={() => act({ action: 'headline' }, 'Now the headline.')}
                  className="rounded-md border border-slate-700 px-2.5 py-1.5 text-slate-300 hover:bg-slate-800">Make headline</button>
              )}
              <button disabled={busy} onClick={() => { if (confirm('Hide this story from your Society’s News?')) void act({ action: 'hide' }, 'Hidden.'); }}
                className="rounded-md border border-rose-900/60 px-2.5 py-1.5 text-rose-300 hover:bg-rose-950/40">Hide from our News</button>
            </div>
          )}
          {message && <p className="mt-3 text-sm text-slate-400">{message}</p>}
        </div>
      </article>
    </div>
  );
}
