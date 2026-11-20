'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Magazine, type Story } from './Tiles';
import StoryModal from './StoryModal';
import Research, { type Paper } from './Research';

type Place = { name: string; kind: 'country' | 'admin1' | 'place'; geonames_id: number | null; country: string; admin1: string | null; lat: number | null; lon: number | null; population?: number | null };
type Section = { id?: string; heading: string; phrases: string; must_include: string | null; must_exclude: string | null };
type Settings = {
  enabled: boolean; title: string | null; cadence: 'daily' | 'weekly'; publish_time: string; publish_weekday: number;
  locations: Place[]; min_score: number; max_items: number; sections: Section[]; include_papers?: boolean;
};
type PhraseFeedback = { section_key: string; phrase: string; words: number; warnings: string[]; matching_stories: number; example: string | null; closest_topics: { label: string; similarity: number }[] };
type Preview = {
  window_hours: number; min_score: number; headline: Story | null;
  sections: { key: string; heading: string; items: Story[] }[];
  near_misses: { cluster_id: string; title: string; section_heading: string; relevance: number; score: number; reason: string }[];
  phrases: PhraseFeedback[]; note: string; papers?: Paper[];
};

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const KIND_LABEL = { country: 'Country', admin1: 'Region', place: 'Town or city' };
const input = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none';
const label = 'mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500';

function Guidance() {
  return (
    <details className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-slate-300" open>
      <summary className="cursor-pointer font-semibold text-blue-200">How to write good search phrases</summary>
      <div className="mt-3 space-y-3">
        <p>News matches stories by <em>meaning</em>, not exact words, so each phrase should describe a subject the way a headline would.</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong>Use short descriptive phrases of 3 to 10 words</strong>, e.g. <q>heat pump grants for households</q>. It will also find <q>home heating subsidies</q>.</li>
          <li><strong>Avoid single words</strong> such as <q>heat</q> or <q>Mercury</q>: they mean too many things.</li>
          <li><strong>One subject per phrase.</strong> Write <q>heat pump grants</q> and <q>insulation schemes</q> as two lines, not one long sentence.</li>
          <li><strong>Leave places out of phrases</strong> and add them under Places instead, so <q>Bristol</q> means Bristol, England, not Bristol, Connecticut.</li>
          <li><strong>Use the word filters for exact words.</strong> “Must include” needs at least one of the words in the story; “Must exclude” drops stories with any of them (e.g. <q>share price</q>).</li>
          <li><strong>Test before you save.</strong> The test shows what an edition would contain right now, how well each phrase matches, and why other stories were left out.</li>
        </ul>
      </div>
    </details>
  );
}

function PlacePicker({ places, onChange }: { places: Place[]; onChange: (p: Place[]) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      const r = await fetch(`/api/news/locations?q=${encodeURIComponent(q)}`);
      if (r.ok) setResults((await r.json()).places ?? []);
    }, 250);
  }, [q]);
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {places.map((p, n) => (
          <span key={`${p.geonames_id}-${n}`} className="flex items-center gap-1.5 rounded-full bg-slate-800 py-1 pl-3 pr-1.5 text-sm text-slate-200">
            📍 {p.name}{p.kind !== 'country' && <span className="text-xs text-slate-500">{p.country}</span>}
            <button onClick={() => onChange(places.filter((_, i) => i !== n))} className="rounded-full px-1.5 text-slate-500 hover:text-rose-300" aria-label={`Remove ${p.name}`}>×</button>
          </span>
        ))}
        {places.length === 0 && <span className="text-sm text-slate-500">Anywhere</span>}
      </div>
      <div className="relative">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Add a country, region or town…" className={input} />
        {results.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
            {results.map(p => (
              <li key={p.geonames_id ?? p.name}>
                <button onClick={() => { onChange([...places, p]); setQ(''); setResults([]); }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-800">
                  <span className="text-slate-200">{p.name} <span className="text-slate-500">{p.country}{p.admin1 && p.kind === 'place' ? ` · ${p.admin1}` : ''}</span></span>
                  <span className="text-xs text-slate-500">{KIND_LABEL[p.kind]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-1.5 text-xs text-slate-500">Stories about these places, or about a wider area that includes them (e.g. the UK for Scotland), are kept. Leave empty for news from anywhere.</p>
    </div>
  );
}

export default function NewsSettings({ societyId }: { societyId: number }) {
  const [s, setS] = useState<Settings | null>(null);
  const [defaultTitle, setDefaultTitle] = useState('');
  const [societyName, setSocietyName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [preview, setPreview] = useState<{ data: Preview; sectionIds: string[] } | null>(null);
  const [open, setOpen] = useState<Story | null>(null);

  useEffect(() => {
    fetch(`/api/societies/${societyId}/news/settings`).then(async r => {
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? 'Could not load the settings.'); return; }
      setS(d.settings); setDefaultTitle(d.defaultTitle); setSocietyName(d.societyName);
    });
  }, [societyId]);

  if (!s) return error ? <p className="text-sm text-rose-400">{error}</p> : <div className="h-96 rounded-2xl bg-slate-800/40 animate-pulse" />;

  const update = (patch: Partial<Settings>) => setS({ ...s, ...patch });
  const setSection = (n: number, patch: Partial<Section>) => update({ sections: s.sections.map((x, i) => i === n ? { ...x, ...patch } : x) });
  const move = (n: number, by: number) => {
    const list = [...s.sections];
    const [x] = list.splice(n, 1);
    list.splice(n + by, 0, x);
    update({ sections: list });
  };
  const placeholderTitle = s.title ? defaultTitle : `${societyName} ${s.cadence === 'weekly' ? 'Weekly' : 'Daily'} News`;

  async function test() {
    setTesting(true); setError(''); setNotice('');
    const r = await fetch(`/api/societies/${societyId}/news/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
    const d = await r.json().catch(() => ({}));
    setTesting(false);
    if (!r.ok) { setError(d.error ?? 'The test didn’t work.'); return; }
    setPreview({ data: d.preview, sectionIds: d.sectionIds });
    setTimeout(() => document.getElementById('news-preview')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  async function save() {
    setSaving(true); setError(''); setNotice('');
    const r = await fetch(`/api/societies/${societyId}/news/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) { setError(d.error ?? 'Could not save.'); return; }
    setS(d.settings);
    setNotice(d.warning ?? 'Saved. New editions will follow these settings.');
  }

  // Preview sections are keyed by the ids sent; map them back to headings on the form
  const headingFor = (key: string) => {
    const n = preview?.sectionIds.indexOf(key) ?? -1;
    return n >= 0 ? s.sections[n]?.heading ?? '' : '';
  };
  const previewItems: Story[] = preview
    ? [...(preview.data.headline ? [preview.data.headline] : []), ...preview.data.sections.flatMap(x => x.items)]
    : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href={`/society/${societyId}/news`} className="text-xs text-slate-500 hover:text-slate-300">← Back to News</Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-100">News settings</h1>
        </div>
      </div>

      <Guidance />

      <section className="card-dr space-y-4 p-5">
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input type="checkbox" checked={s.enabled} onChange={e => update({ enabled: e.target.checked })} className="h-4 w-4 accent-blue-500" />
          Publish News for this Society
        </label>
        <div>
          <label className={label}>Title</label>
          <input value={s.title ?? ''} onChange={e => update({ title: e.target.value || null })} placeholder={placeholderTitle} maxLength={120} className={input} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>Frequency</label>
            <select value={s.cadence} onChange={e => update({ cadence: e.target.value as Settings['cadence'] })} className={input}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          {s.cadence === 'weekly' && (
            <div>
              <label className={label}>Day</label>
              <select value={s.publish_weekday} onChange={e => update({ publish_weekday: Number(e.target.value) })} className={input}>
                {WEEKDAYS.map((d, n) => <option key={d} value={n}>{d}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className={label}>Time (UK)</label>
            <input type="time" value={s.publish_time} onChange={e => update({ publish_time: e.target.value })} className={input} />
          </div>
        </div>
      </section>

      <section className="card-dr space-y-3 p-5">
        <h2 className="text-sm font-semibold text-slate-200">Places</h2>
        <PlacePicker places={s.locations} onChange={locations => update({ locations })} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Sections</h2>
          <span className="text-xs text-slate-500">Each section is a heading in the edition</span>
        </div>
        {s.sections.map((sec, n) => (
          <div key={sec.id ?? `new-${n}`} className="card-dr space-y-3 p-5">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <label className={label}>Heading</label>
                <input value={sec.heading} onChange={e => setSection(n, { heading: e.target.value })} maxLength={80} placeholder="e.g. Energy & Climate" className={input} />
              </div>
              <div className="flex gap-1 pt-6">
                <button onClick={() => move(n, -1)} disabled={n === 0} className="rounded px-2 py-1 text-slate-500 hover:bg-slate-800 disabled:opacity-30" aria-label="Move up">↑</button>
                <button onClick={() => move(n, 1)} disabled={n === s.sections.length - 1} className="rounded px-2 py-1 text-slate-500 hover:bg-slate-800 disabled:opacity-30" aria-label="Move down">↓</button>
                <button onClick={() => update({ sections: s.sections.filter((_, i) => i !== n) })} className="rounded px-2 py-1 text-rose-400 hover:bg-rose-950/40" aria-label="Remove section">✕</button>
              </div>
            </div>
            <div>
              <label className={label}>Search phrases — one per line</label>
              <textarea value={sec.phrases} onChange={e => setSection(n, { phrases: e.target.value })} rows={4}
                placeholder={'heat pump grants for households\noffshore wind farm approvals\nenergy bills and price cap changes'} className={`${input} font-mono`} />
              {sec.phrases.split('\n').some(l => l.includes(',')) && (
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-amber-300">
                  Each line is one phrase, so a comma-separated list is read as a single long phrase and matches poorly.
                  <button type="button" className="rounded border border-amber-500/40 px-2 py-0.5 hover:bg-amber-500/10"
                    onClick={() => setSection(n, { phrases: sec.phrases.split(/[,\n]/).map(x => x.trim().replace(/\.$/, '')).filter(Boolean).join('\n') })}>
                    Split into lines
                  </button>
                </p>
              )}
            </div>
            <details>
              <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">Word filters (optional)</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={label}>Must include one of</label>
                  <input value={sec.must_include ?? ''} onChange={e => setSection(n, { must_include: e.target.value || null })} placeholder="comma, separated, words" className={input} />
                </div>
                <div>
                  <label className={label}>Must exclude</label>
                  <input value={sec.must_exclude ?? ''} onChange={e => setSection(n, { must_exclude: e.target.value || null })} placeholder="e.g. share price, football" className={input} />
                </div>
              </div>
            </details>
          </div>
        ))}
        {s.sections.length < 12 && (
          <button onClick={() => update({ sections: [...s.sections, { heading: '', phrases: '', must_include: null, must_exclude: null }] })}
            className="w-full rounded-xl border border-dashed border-slate-700 py-3 text-sm text-slate-400 hover:border-slate-500 hover:text-slate-200">
            + Add a section
          </button>
        )}
      </section>

      <section className="card-dr grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <label className={label}>Minimum relevance: {s.min_score}</label>
          <input type="range" min={0} max={80} value={s.min_score} onChange={e => update({ min_score: Number(e.target.value) })} className="w-full accent-blue-500" />
          <p className="mt-1 text-xs text-slate-500">Stories below this aren’t printed. Lower it for fuller editions; raise it for only the most important news.</p>
        </div>
        <div>
          <label className={label}>Stories per edition</label>
          <input type="number" min={1} max={30} value={s.max_items} onChange={e => update({ max_items: Number(e.target.value) })} className={input} />
          <p className="mt-1 text-xs text-slate-500">At most four per section; the most relevant story becomes the headline.</p>
        </div>
        <div className="sm:col-span-2 border-t border-slate-800 pt-4">
          <label className="flex items-start gap-2 text-sm text-slate-200">
            <input type="checkbox" checked={!!s.include_papers} onChange={e => update({ include_papers: e.target.checked })} className="mt-0.5 h-4 w-4 accent-blue-500" />
            <span>
              Include scientific papers
              <span className="mt-0.5 block text-xs text-slate-500">
                Each edition adds a “New research” part: up to five papers and preprints published in the last 90 days that match your
                sections’ phrases, each shown once, with a one-line plain-English summary when AI is on. Preprints are marked as not yet
                peer reviewed. Papers for new phrases are searched within the hour after you save.
              </span>
            </span>
          </label>
        </div>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <button onClick={test} disabled={testing || !s.sections.length} className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40">
          {testing ? 'Testing…' : 'Test'}
        </button>
        <button onClick={save} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
        {error && <span className="text-sm text-rose-400">{error}</span>}
        {notice && <span className="text-sm text-emerald-400">{notice}</span>}
      </div>

      {preview && (
        <section id="news-preview" className="space-y-6 rounded-2xl border border-slate-800 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Test result</h2>
            <p className="text-xs text-slate-500">
              Stories from the last {preview.data.window_hours} hours, minimum relevance {preview.data.min_score}. {preview.data.note}
            </p>
          </div>

          <div>
            <h3 className={label}>Your search phrases</h3>
            <div className="divide-y divide-slate-800 rounded-xl border border-slate-800">
              {preview.data.phrases.map((p, n) => (
                <div key={n} className="p-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-mono text-slate-200">{p.phrase} <span className="font-sans text-xs text-slate-500">· {headingFor(p.section_key)}</span></span>
                    <span className={`text-xs ${p.matching_stories ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {p.matching_stories} matching {p.matching_stories === 1 ? 'story' : 'stories'}
                    </span>
                  </div>
                  {p.example && <p className="mt-1 text-xs text-slate-500">Best match: “{p.example}”</p>}
                  {p.warnings.filter(w => !w.startsWith('No stories')).map(w => <p key={w} className="mt-1 text-xs text-amber-300">⚠ {w}</p>)}
                </div>
              ))}
            </div>
          </div>

          {previewItems.length
            ? <Magazine items={previewItems.map(i => ({ ...i, section_heading: headingFor(i.section_key) || i.section_heading }))} onOpen={setOpen} explain />
            : <p className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-400">No stories would be printed right now. Try broader phrases, fewer word filters, or a lower minimum relevance.</p>}

          {s.include_papers && (preview.data.papers?.length
            ? <Research papers={preview.data.papers.map(p => ({ ...p, section_heading: headingFor(p.section_key) || p.section_heading }))} societyId={societyId} canPost={false} canModerate={false} />
            : <p className="rounded-xl border border-dashed border-slate-800 p-4 text-center text-sm text-slate-400">No matching research found yet. Papers for new phrases are searched within the hour after you save.</p>)}

          {preview.data.near_misses.length > 0 && (
            <div>
              <h3 className={label}>Close but left out</h3>
              <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800 text-sm">
                {preview.data.near_misses.map(m => (
                  <li key={m.cluster_id} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
                    <span className="text-slate-300">{m.title}</span>
                    <span className="text-xs text-slate-500">{m.reason} · relevance {Math.round(m.relevance)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {open && <StoryModal story={open} societyId={societyId} canPost={false} canModerate={false} onClose={() => setOpen(null)} />}
    </div>
  );
}
