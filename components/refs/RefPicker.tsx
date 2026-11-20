'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { REF_ICON, REF_NAME, refUrl, type Ref, type RefInfo, type RefKind } from '@/lib/refs';
import { openInfo } from './resolve';

export type Picked = { ref: Ref; url: string; title: string; sealed: boolean };
type Row = RefInfo & { locked: boolean };

const FILTERS: { key: RefKind | 'all'; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'note', label: 'Notes' }, { key: 'doc', label: 'Files & links' },
  { key: 'event', label: 'Events' }, { key: 'thread', label: 'Discussions' },
];
const day = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Choose an item of this Society to reference. Sealed items' names are opened
// here with this person's keys; ones they can't open are left out.
export default function RefPicker({ society, exclude, onPick, onClose }: {
  society: number; exclude?: string; onPick: (p: Picked) => void; onClose: () => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<RefKind | 'all'>('all');
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const r = await fetch(`/api/societies/${society}/refs?list=1`);
      if (!r.ok) throw new Error();
      const { items } = await r.json() as { items: RefInfo[] };
      const opened = await Promise.all(items.map(i => openInfo(society, i, ['file_name'])));
      if (live) setRows(opened.filter(i => !i.locked && i.id !== exclude));
    })().catch(() => { if (live) setError('Couldn’t load this Society’s items.'); });
    search.current?.focus();
    return () => { live = false; };
  }, [society, exclude]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (rows ?? [])
      .filter(r => kind === 'all' || r.kind === kind)
      .filter(r => words.every(w => `${r.title} ${r.file_name ?? ''} ${r.author ?? ''}`.toLowerCase().includes(w)))
      .slice(0, 100);
  }, [rows, q, kind]);

  const pick = (r: Row) => {
    const ref: Ref = { society, kind: r.kind, id: r.id };
    onPick({ ref, url: refUrl(ref), title: r.title, sealed: !!r.sealed });
  };
  const meta = (r: Row) => r.kind === 'event' ? day(r.starts_at!)
    : r.kind === 'thread' ? `${r.posts} message${r.posts === 1 ? '' : 's'}`
    : r.kind === 'doc' ? (r.docKind === 'link' ? 'Link' : r.file_name ?? 'File')
    : 'Note';

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/60 p-2 pt-[8vh] backdrop-blur-sm sm:p-6 sm:pt-[10vh]"
      onClick={e => { e.stopPropagation(); onClose(); }} role="dialog" aria-modal="true" aria-label="Add a reference">
      <div className="dr-panel flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="space-y-2 border-b border-slate-700/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <p className="flex-1 text-sm font-semibold text-slate-100">Reference another item</p>
            <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-0.5 text-lg leading-none text-slate-400 hover:bg-slate-700/50 hover:text-white">×</button>
          </div>
          <input ref={search} value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name…"
            onKeyDown={e => { if (e.key === 'Enter' && shown[0]) { e.preventDefault(); pick(shown[0]); } }}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none" />
          <div className="flex flex-wrap gap-1">
            {FILTERS.map(f => (
              <button key={f.key} type="button" onClick={() => setKind(f.key)}
                className={`rounded-full px-2.5 py-0.5 text-xs ${kind === f.key ? 'bg-blue-500/25 text-blue-200' : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'}`}>{f.label}</button>
            ))}
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto py-1">
          {error ? <li className="px-4 py-3 text-sm text-rose-400">{error}</li>
            : !rows ? <li className="px-4 py-3 text-sm text-slate-500">Loading…</li>
            : !shown.length ? <li className="px-4 py-3 text-sm text-slate-500">Nothing found.</li>
            : shown.map(r => (
              <li key={`${r.kind}:${r.id}`}>
                <button type="button" onClick={() => pick(r)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-slate-700/40 focus:bg-slate-700/40 focus:outline-none">
                  <span aria-hidden>{REF_ICON[r.kind]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-100">{r.sealed && <span className="mr-1" title="Sealed">🔐</span>}{r.title}</span>
                    <span className="block truncate text-[11px] text-slate-500">{REF_NAME[r.kind]} · {meta(r)}{r.author ? ` · @${r.author}` : ''}</span>
                  </span>
                </button>
              </li>
            ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
