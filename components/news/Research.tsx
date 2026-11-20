'use client';

import Link from 'next/link';
import { useState } from 'react';

// A scientific paper or preprint in a News edition (from News' research search)
export type Paper = {
  item_id: string; kind: 'paper' | 'preprint'; preprint: boolean; title: string;
  summary: string | null; abstract_opening: string; url: string | null; doi: string | null;
  venue: string | null; authors: string[]; author_count: number; published_at: string | null;
  open_access: boolean; cited_by: number; section_key: string; section_heading: string;
};

const day = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const byline = (p: Paper) => p.authors.length ? `${p.authors.join(', ')}${p.author_count > p.authors.length ? ' et al.' : ''}` : '';

// A reference for a debate's evidence or a discussion
function citation(p: Paper) {
  const year = p.published_at ? new Date(p.published_at).getFullYear() : '';
  return [byline(p), year && `(${year})`, p.title + '.', p.venue ? `${p.venue}.` : '', p.preprint ? 'Preprint, not yet peer reviewed.' : '', p.doi || p.url]
    .filter(Boolean).join(' ');
}

// The edition's "New research": papers published in the last 90 days that match
// the Society's sections, each with a plain-English line where AI is on.
export default function Research({ papers, societyId, canPost, canModerate }: {
  papers: Paper[]; societyId: number; canPost: boolean; canModerate: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  if (!papers.length) return null;

  async function copy(p: Paper) {
    try { await navigator.clipboard.writeText(citation(p)); } catch { return; }
    setCopied(p.item_id);
    setTimeout(() => setCopied(c => (c === p.item_id ? null : c)), 2000);
  }

  return (
    <section className="mt-12" aria-labelledby="research-h">
      <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-slate-700 pb-2">
        <h2 id="research-h" className="font-serif text-2xl font-bold text-slate-100">New research</h2>
        <span className="text-xs text-slate-500">Papers from the last 90 days matching this Society’s topics</span>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {papers.map(p => {
          const discussBody = `${p.summary || p.abstract_opening}\n\n${citation(p)}`;
          const debateHref = `/dashboard/new-debate?society=${societyId}&title=${encodeURIComponent(p.title)}`;
          const discussHref = `/society/${societyId}/discussions?new=1&title=${encodeURIComponent(p.title)}&body=${encodeURIComponent(discussBody)}`;
          return (
            <li key={p.item_id} className="dr-panel flex flex-col rounded-xl p-4">
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                {p.section_heading && <span className="font-semibold uppercase tracking-wider text-blue-300">{p.section_heading}</span>}
                {p.preprint
                  ? <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-300">Preprint, not yet peer reviewed</span>
                  : <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-300">Peer reviewed</span>}
                {p.open_access && <span className="rounded-full border border-slate-600 px-2 py-0.5 text-slate-400">Free to read</span>}
              </div>
              <h3 className="font-serif text-lg font-semibold leading-snug text-slate-100">
                {p.url
                  ? <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-blue-300 hover:underline">{p.title}</a>
                  : p.title}
              </h3>
              <p className="mt-1 text-xs text-slate-500">{[byline(p), p.venue, day(p.published_at)].filter(Boolean).join(' · ')}</p>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-300">
                {p.summary || p.abstract_opening}
                {!p.summary && <span className="text-slate-500"> (from the abstract)</span>}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                {canModerate && <Link href={debateHref} className="font-semibold text-blue-400 hover:text-blue-300">Start a debate</Link>}
                {canPost && <Link href={discussHref} className="font-semibold text-blue-400 hover:text-blue-300">Discuss</Link>}
                <button type="button" onClick={() => copy(p)} title="Click to copy to clipboard" className="text-slate-400 hover:text-slate-200">
                  Copy citation
                </button>
                {copied === p.item_id && <span role="status" className="font-semibold text-emerald-400">Copied to clipboard</span>}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-slate-600">
        Found through OpenAlex, an open index of scholarly work.
        {papers.some(p => p.summary) ? ' The one-line summaries are written by AI from each abstract and may contain mistakes; follow the links for the papers themselves.' : ''}
      </p>
    </section>
  );
}
