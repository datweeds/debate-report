'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Magazine, type Story } from './Tiles';
import StoryModal from './StoryModal';

type Edition = { id: string; edition_date: string; cadence: string; overview: string | null; items: Story[]; created_at: string };
type Data = {
  society: { id: number; name: string };
  title: string; cadence: string; publishTime: string; publishWeekday: number;
  available: boolean; configured: boolean; enabled: boolean;
  editions: { id: string; edition_date: string; item_count: number; created_at: string }[];
  edition: Edition | null;
  canModerate: boolean; canPost: boolean;
};

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function longDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// The Society's News, laid out like a magazine: masthead with the edition's
// date, the headline, then each section's stories as tiles.
export default function SocietyNews({ societyId }: { societyId: number }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [editionId, setEditionId] = useState<string | null>(null);
  const [open, setOpen] = useState<Story | null>(null);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async (id: string | null) => {
    const r = await fetch(`/api/societies/${societyId}/news${id ? `?edition=${id}` : ''}`);
    if (!r.ok) { setError('Could not load the News.'); return; }
    setData(await r.json());
  }, [societyId]);
  useEffect(() => { void load(editionId); }, [load, editionId]);

  async function publishNow() {
    setPublishing(true); setError('');
    const r = await fetch(`/api/societies/${societyId}/news/publish`, { method: 'POST' });
    const d = await r.json().catch(() => ({}));
    setPublishing(false);
    if (!r.ok) { setError(d.error ?? 'Could not publish an edition.'); return; }
    setEditionId(null);
    await load(null);
  }

  if (!data) return error ? <p className="text-sm text-rose-400">{error}</p> : <div className="h-96 rounded-2xl bg-slate-800/40 animate-pulse" />;

  const { edition, editions } = data;
  const index = edition ? editions.findIndex(e => e.id === edition.id) : -1;
  const schedule = data.cadence === 'weekly'
    ? `every ${WEEKDAYS[data.publishWeekday]} at ${data.publishTime}` : `every day at ${data.publishTime}`;

  return (
    <div className="mx-auto max-w-7xl">
      {/* Masthead (a div: the site styles every <header> as the page header) */}
      <div className="border-b-4 border-double border-slate-700 pb-5 text-center">
        <h1 className="font-serif text-3xl font-black uppercase tracking-tight text-slate-100 sm:text-5xl lg:text-6xl">{data.title}</h1>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-slate-400">
          {edition ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setEditionId(editions[index + 1]?.id ?? null)} disabled={index < 0 || index >= editions.length - 1}
                className="rounded px-2 py-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30" aria-label="Earlier edition">‹</button>
              <select value={edition.id} onChange={e => setEditionId(e.target.value)}
                className="bg-transparent font-medium text-slate-300 focus:outline-none" aria-label="Edition">
                {editions.map(e => <option key={e.id} value={e.id} className="bg-slate-900">{longDate(e.edition_date)}</option>)}
              </select>
              <button onClick={() => setEditionId(index > 0 ? editions[index - 1].id : null)} disabled={index <= 0}
                className="rounded px-2 py-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30" aria-label="Later edition">›</button>
            </div>
          ) : (
            <span>{longDate(new Date().toISOString())}</span>
          )}
          {data.canModerate && (
            <span className="flex items-center gap-3 text-xs">
              <Link href={`/society/${societyId}/news/settings`} className="text-blue-400 hover:text-blue-300">News settings</Link>
              {data.configured && (
                <button onClick={publishNow} disabled={publishing} className="text-blue-400 hover:text-blue-300 disabled:text-slate-500">
                  {publishing ? 'Publishing…' : 'Publish an edition now'}
                </button>
              )}
            </span>
          )}
        </div>
        {edition?.overview && <p className="mx-auto mt-4 max-w-3xl font-serif text-lg italic leading-relaxed text-slate-300">{edition.overview}</p>}
      </div>
      {error && <p className="mt-4 text-center text-sm text-rose-400">{error}</p>}

      <div className="mt-8">
        {!data.available ? (
          <Empty>News isn’t available on this server yet.</Empty>
        ) : !data.configured ? (
          data.canModerate ? (
            <Empty>
              <p className="font-serif text-xl text-slate-200">Set up your Society’s News</p>
              <p className="mt-2 max-w-xl text-sm text-slate-400">
                Choose the topics your members care about as sections, each described by a few search phrases, and the places
                that matter to you. News gathers coverage from many outlets, groups it into stories and publishes a daily or
                weekly edition here.
              </p>
              <Link href={`/society/${societyId}/news/settings`} className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
                Set up News
              </Link>
            </Empty>
          ) : <Empty>This Society hasn’t set up its News yet.</Empty>
        ) : !edition ? (
          <Empty>
            {data.enabled ? `The first edition will be published ${schedule}.` : 'News is paused for this Society.'}
          </Empty>
        ) : edition.items.length === 0 ? (
          <Empty>Nothing significant in this edition.</Empty>
        ) : (
          <Magazine items={edition.items} onOpen={setOpen} />
        )}
      </div>

      {edition && edition.items.length > 0 && (
        <p className="mt-12 border-t border-slate-800 pt-4 text-center text-xs text-slate-600">
          Stories gathered from {new Set(edition.items.flatMap(i => i.top_sources.map(s => s.outlet))).size} outlets.
          {edition.overview || edition.items.some(i => i.why_it_matters)
            ? ' Summaries are written by AI from the outlets’ headlines and may contain mistakes; follow the links for the full reporting.'
            : ' Headlines and summaries are the outlets’ own; follow the links for the full reporting.'}
        </p>
      )}

      {open && (
        <StoryModal story={open} societyId={societyId} canPost={data.canPost} canModerate={data.canModerate}
          onClose={() => setOpen(null)} onChanged={() => load(editionId)} />
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-800 px-6 py-16 text-center text-slate-400">{children}</div>;
}
