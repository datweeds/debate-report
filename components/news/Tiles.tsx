'use client';

import { useState } from 'react';

export type Source = { title: string; url: string | null; outlet: string; published_at: string | null; kind?: string };

export type Story = {
  cluster_id: string;
  title: string;
  summary: string | null;
  why_it_matters: string | null;
  image_url: string | null;
  section_key: string;
  section_heading: string;
  is_headline: boolean;
  is_update: boolean;
  score: number;
  relevance: number;
  first_seen: string;
  last_activity: string;
  item_count: number;
  source_count: number;
  topics: string[];
  locations: string[];
  top_sources: Source[];
  editor_note: string | null;
  // previews only
  topic_similarity?: number;
  location_factor?: number;
};

export function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function sourceLine(s: Story) {
  const first = s.top_sources[0]?.outlet ?? 'Source';
  return s.source_count > 1 ? `${first} + ${s.source_count - 1} more` : first;
}

// The outlet's own image, linked (not copied). Only https, and hidden if it fails.
function StoryImage({ src, className }: { src: string | null; className: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed || !src.startsWith('https://')) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)}
      className={`${className} object-cover bg-slate-800`} />
  );
}

function Badges({ s, explain }: { s: Story; explain?: boolean }) {
  return (
    <>
      {s.is_update && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">Update</span>}
      {s.editor_note && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">Editor’s pick</span>}
      {explain && (
        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400"
          title={`Importance ${s.score} × topic match × place match (${s.location_factor ?? 1}) = relevance ${s.relevance}. Phrase similarity ${s.topic_similarity ?? '–'}.`}>
          {Math.round(s.relevance)} · imp {Math.round(s.score)}
        </span>
      )}
    </>
  );
}

export function HeadlineTile({ s, onOpen, explain }: { s: Story; onOpen: () => void; explain?: boolean }) {
  return (
    <button onClick={onOpen} className="group grid w-full gap-5 text-left md:grid-cols-5">
      <StoryImage src={s.image_url} className="aspect-[16/10] w-full rounded-xl md:col-span-3" />
      <div className={s.image_url ? 'md:col-span-2' : 'md:col-span-5'}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-400">{s.section_heading || 'Headline'}</span>
          <Badges s={s} explain={explain} />
        </div>
        <h2 className="font-serif text-2xl font-bold leading-tight text-slate-100 group-hover:text-blue-200 sm:text-3xl lg:text-4xl">{s.title}</h2>
        {s.summary && <p className="mt-3 text-[15px] leading-relaxed text-slate-300">{s.summary}</p>}
        {s.why_it_matters && (
          <p className="mt-3 border-l-2 border-blue-500/60 pl-3 text-sm italic text-slate-400">{s.why_it_matters}</p>
        )}
        <p className="mt-4 text-xs text-slate-500">{sourceLine(s)} · {timeAgo(s.last_activity)}</p>
      </div>
    </button>
  );
}

export function StoryTile({ s, onOpen, explain }: { s: Story; onOpen: () => void; explain?: boolean }) {
  return (
    <button onClick={onOpen}
      className="group flex h-full w-full flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 text-left transition-colors hover:border-slate-700 hover:bg-slate-900/80">
      <StoryImage src={s.image_url} className="aspect-video w-full" />
      <div className="flex flex-1 flex-col p-4">
        {(s.is_update || s.editor_note || explain) && <div className="mb-2 flex flex-wrap gap-1.5"><Badges s={s} explain={explain} /></div>}
        <h3 className="font-serif text-lg font-bold leading-snug text-slate-100 line-clamp-3 group-hover:text-blue-200">{s.title}</h3>
        {s.summary && <p className="mt-2 text-sm leading-relaxed text-slate-400 line-clamp-3">{s.summary}</p>}
        <p className="mt-auto pt-3 text-xs text-slate-500">{sourceLine(s)} · {timeAgo(s.last_activity)}</p>
      </div>
    </button>
  );
}

// Headline first, then each section's tiles under its heading
export function Magazine({ items, onOpen, explain }: { items: Story[]; onOpen: (s: Story) => void; explain?: boolean }) {
  const headline = items.find(i => i.is_headline);
  const rest = items.filter(i => i !== headline);
  const sections: { heading: string; stories: Story[] }[] = [];
  for (const s of rest) {
    const group = sections.find(g => g.heading === s.section_heading);
    if (group) group.stories.push(s); else sections.push({ heading: s.section_heading, stories: [s] });
  }
  return (
    <div className="space-y-10">
      {headline && (
        <section className="border-b border-slate-800 pb-10">
          <HeadlineTile s={headline} onOpen={() => onOpen(headline)} explain={explain} />
        </section>
      )}
      {sections.map(g => (
        <section key={g.heading}>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-300">{g.heading}</h2>
            <div className="h-px flex-1 bg-slate-800" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {g.stories.map(s => <StoryTile key={s.cluster_id} s={s} onOpen={() => onOpen(s)} explain={explain} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
