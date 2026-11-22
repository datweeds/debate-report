'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Cat = { name: string; color: string };
type Item = { cats?: Cat[]; status?: string; key: string; type: TypeKey; role: string; title: string; sub: string | null; society: { id: number; name: string } | null; href: string; at: string };
type TypeKey = 'discussions' | 'events' | 'documents' | 'polls' | 'debate' | 'project_tasks' | 'projects' | 'tasks' | 'principles' | 'requests';

const TYPES: { key: TypeKey; label: string; icon: string }[] = [
  { key: 'discussions', label: 'Discussions', icon: '💬' },
  { key: 'events', label: 'Events', icon: '📅' },
  { key: 'documents', label: 'Documents', icon: '📄' },
  { key: 'polls', label: 'Polls', icon: '📊' },
  { key: 'debate', label: 'Debate', icon: '⚖️' },
  { key: 'project_tasks', label: 'Project tasks', icon: '◆' },
  { key: 'projects', label: 'Projects', icon: '📁' },
  { key: 'tasks', label: 'Tasks', icon: '☑' },
  { key: 'principles', label: 'Principles', icon: '📜' },
  { key: 'requests', label: 'Requests', icon: '✉️' },
];
const TYPE = Object.fromEntries(TYPES.map(t => [t.key, t])) as Record<TypeKey, typeof TYPES[number]>;

type Period = '1d' | '7d' | 'week' | 'month' | 'all';
const PERIODS: { key: Period; label: string }[] = [
  { key: '1d', label: '1 day' }, { key: '7d', label: '7 days' }, { key: 'week', label: 'This week' }, { key: 'month', label: 'This month' }, { key: 'all', label: 'All' },
];
function periodStart(p: Period): number {
  const now = new Date();
  if (p === '1d') return now.getTime() - 864e5;
  if (p === '7d') return now.getTime() - 7 * 864e5;
  if (p === 'week') { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
  if (p === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return 0;
}
type Sort = 'new' | 'old' | 'az' | 'za';
type Prefs = { types: TypeKey[]; period: Period; society: number | 0; sort: Sort; view: 'list' | 'tiles'; cats: string[]; statuses: string[] };
const DEFAULTS: Prefs = { types: [], period: 'all', society: 0, sort: 'new', view: 'list', cats: [], statuses: [] };
// Project task statuses, in the order they move through
const PT_STATUSES: { key: string; label: string }[] = [
  { key: 'new', label: 'New' }, { key: 'in_progress', label: 'In progress' }, { key: 'paused', label: 'Paused' }, { key: 'complete', label: 'Complete' },
];
const PT_LABEL = Object.fromEntries(PT_STATUSES.map(s => [s.key, s.label]));
const NO_CAT = '';   // the "No category" choice
// Categories are personal to each Society, so the same name in two Societies counts as one
const catKey = (n: string) => n.trim().toLowerCase();
const hasCats = (i: Item) => i.type === 'tasks' || i.type === 'project_tasks';
const PREFS_KEY = 'nv-mystuff';

// Each Society gets its own colour, kept steady by its place in your list
const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444', '#84cc16', '#06b6d4', '#f97316', '#a855f7', '#eab308'];

// Roles that read as good / bad news get a tint
const ROLE_TONE: Record<string, string> = {
  Attending: 'text-emerald-300 border-emerald-500/40', Agreed: 'text-emerald-300 border-emerald-500/40', Complete: 'text-emerald-300 border-emerald-500/40',
  'Not coming': 'text-rose-300 border-rose-500/40', Disagreed: 'text-rose-300 border-rose-500/40',
  'In progress': 'text-blue-300 border-blue-500/40', Paused: 'text-amber-300 border-amber-500/40',
  Approved: 'text-emerald-300 border-emerald-500/40', Accepted: 'text-emerald-300 border-emerald-500/40',
  Rejected: 'text-rose-300 border-rose-500/40', Declined: 'text-rose-300 border-rose-500/40',
  'Awaiting a decision': 'text-amber-300 border-amber-500/40', Flagged: 'text-amber-300 border-amber-500/40',
};

const when = (s: string) => {
  const d = new Date(s), today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
};

// Everything you've done, across all your Societies, in one list
export default function MyStuff() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(200);
  const [lastVisit, setLastVisit] = useState(0);

  useEffect(() => {
    try { const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null'); if (p) setPrefs({ ...DEFAULTS, ...p }); } catch {}
    // Items since your last visit get a dot; opening the page clears the menu's badge
    try { setLastVisit(Number(localStorage.getItem('dr_content_seen')) || 0); localStorage.setItem('dr_content_seen', String(Date.now())); } catch {}
    window.dispatchEvent(new Event('dr:alerts-changed'));
    fetch('/api/user/stuff').then(async r => {
      if (!r.ok) { setError('Couldn’t load your stuff.'); return; }
      const d = await r.json(); setItems(d.items); setFailed(d.failed ?? []);
    }).catch(() => setError('Couldn’t load your stuff.'));
  }, []);
  const update = (p: Partial<Prefs>) => setPrefs(old => {
    const next = { ...old, ...p };
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch {}
    return next;
  });
  useEffect(() => setShown(200), [prefs, q]);

  const societies = useMemo(() => {
    const m = new Map<number, string>();
    for (const i of items ?? []) if (i.society) m.set(i.society.id, i.society.name);
    return [...m].sort((a, b) => a[0] - b[0]).map(([id, name], n) => ({ id, name, color: PALETTE[n % PALETTE.length] }));
  }, [items]);
  const colour = useMemo(() => new Map(societies.map(s => [s.id, s.color])), [societies]);

  // Period, Society and search first; the type chips count what's left
  const base = useMemo(() => {
    const from = periodStart(prefs.period);
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (items ?? []).filter(i => {
      if (from && new Date(i.at).getTime() < from) return false;
      if (prefs.society && i.society?.id !== prefs.society) return false;
      if (!words.length) return true;
      const hay = `${i.title} ${i.sub ?? ''} ${i.role} ${i.society?.name ?? ''} ${TYPE[i.type]?.label ?? ''}`.toLowerCase();
      return words.every(w => hay.includes(w));
    });
  }, [items, prefs.period, prefs.society, q]);
  const counts = useMemo(() => { const c: Record<string, number> = {}; for (const i of base) c[i.type] = (c[i.type] ?? 0) + 1; return c; }, [base]);

  // Task filters show (and apply) only when Tasks or Project tasks is picked: the category
  // filter narrows both, the status filter narrows project tasks
  const catsOn = prefs.types.includes('tasks') || prefs.types.includes('project_tasks');
  const statusOn = prefs.types.includes('project_tasks');
  const typed = useMemo(() => (prefs.types.length ? base.filter(i => prefs.types.includes(i.type)) : base), [base, prefs.types]);
  const catOptions = useMemo(() => {
    const m = new Map<string, { name: string; color: string; n: number }>();
    let none = 0;
    for (const i of typed) {
      if (!hasCats(i)) continue;
      if (!i.cats?.length) { none++; continue; }
      for (const c of i.cats) { const k = catKey(c.name); const o = m.get(k); if (o) o.n++; else m.set(k, { name: c.name, color: c.color, n: 1 }); }
    }
    return { cats: [...m].sort((a, b) => a[1].name.localeCompare(b[1].name)), none };
  }, [typed]);
  const statusCounts = useMemo(() => { const c: Record<string, number> = {}; for (const i of typed) if (i.type === 'project_tasks' && i.status) c[i.status] = (c[i.status] ?? 0) + 1; return c; }, [typed]);
  const catFilter = catsOn && prefs.cats.length > 0, statusFilter = statusOn && prefs.statuses.length > 0;

  const list = useMemo(() => {
    const l = typed.filter(i => {
      if (catFilter && hasCats(i)) {
        const mine = i.cats?.length ? i.cats.map(c => catKey(c.name)) : [NO_CAT];
        if (!mine.some(k => prefs.cats.includes(k))) return false;
      }
      if (statusFilter && i.type === 'project_tasks' && !prefs.statuses.includes(i.status ?? '')) return false;
      return true;
    });
    const t = (i: Item) => i.title.toLowerCase();
    l.sort(prefs.sort === 'az' ? (a, b) => t(a).localeCompare(t(b)) || (b.at > a.at ? 1 : -1)
      : prefs.sort === 'za' ? (a, b) => t(b).localeCompare(t(a)) || (b.at > a.at ? 1 : -1)
      : prefs.sort === 'old' ? (a, b) => (a.at > b.at ? 1 : -1) : (a, b) => (b.at > a.at ? 1 : -1));
    return l;
  }, [typed, prefs.sort, prefs.cats, prefs.statuses, catFilter, statusFilter]);

  const toggleType = (k: TypeKey) => update({ types: prefs.types.includes(k) ? prefs.types.filter(x => x !== k) : [...prefs.types, k] });
  const toggleIn = (key: 'cats' | 'statuses', v: string) => update({ [key]: prefs[key].includes(v) ? prefs[key].filter(x => x !== v) : [...prefs[key], v] } as Partial<Prefs>);
  const filtered = prefs.types.length > 0 || prefs.period !== 'all' || prefs.society !== 0 || q !== '' || catFilter || statusFilter;
  const chip = (on: boolean) => `rounded-full border px-2.5 py-1 text-xs transition-colors ${on ? 'border-blue-500/60 bg-blue-500/15 text-blue-200' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`;

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-10">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-100">My Stuff</h1>
        <p className="mt-1 text-sm text-slate-400">Everything you’ve taken part in, across all your Societies.</p>
      </div>

      {/* Search, Society, sort and view */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} type="search" placeholder="Search all your stuff…" aria-label="Search"
          className="min-w-0 flex-1 basis-64 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none" />
        <select value={prefs.society} onChange={e => update({ society: Number(e.target.value) })} aria-label="Society"
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200">
          <option value={0}>All Societies</option>
          {societies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={prefs.sort} onChange={e => update({ sort: e.target.value as Sort })} aria-label="Sort"
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200">
          <option value="new">Date: newest first</option>
          <option value="old">Date: oldest first</option>
          <option value="az">Title: A–Z</option>
          <option value="za">Title: Z–A</option>
        </select>
        <div className="flex overflow-hidden rounded-lg border border-slate-700 text-xs" role="group" aria-label="View">
          {(['list', 'tiles'] as const).map(v => (
            <button key={v} onClick={() => update({ view: v })} aria-pressed={prefs.view === v}
              className={`px-3 py-2 ${prefs.view === v ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>{v === 'list' ? 'List' : 'Tiles'}</button>
          ))}
        </div>
      </div>

      {/* Type and period */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Item type">
          <button onClick={() => update({ types: [] })} aria-pressed={!prefs.types.length} className={chip(!prefs.types.length)}>All types</button>
          {TYPES.map(t => (
            <button key={t.key} onClick={() => toggleType(t.key)} aria-pressed={prefs.types.includes(t.key)} className={chip(prefs.types.includes(t.key))}>
              <span aria-hidden>{t.icon}</span> {t.label} <span className="text-slate-500">{counts[t.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1 text-xs" role="group" aria-label="Period">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => update({ period: p.key })} aria-pressed={prefs.period === p.key}
              className={`rounded-md px-2 py-1 ${prefs.period === p.key ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>{p.label}</button>
          ))}
        </div>
      </div>

      {(catsOn || statusOn) && (
        <div className="-mt-2 mb-4 space-y-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
          {catsOn && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Task category">
              <span className="mr-1 text-xs text-slate-500">Category</span>
              <button onClick={() => update({ cats: [] })} aria-pressed={!prefs.cats.length} className={chip(!prefs.cats.length)}>All categories</button>
              {catOptions.cats.map(([k, c]) => (
                <button key={k} onClick={() => toggleIn('cats', k)} aria-pressed={prefs.cats.includes(k)} className={chip(prefs.cats.includes(k))}>
                  <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: c.color }} aria-hidden />{c.name} <span className="text-slate-500">{c.n}</span>
                </button>
              ))}
              {catOptions.none > 0 && (
                <button onClick={() => toggleIn('cats', NO_CAT)} aria-pressed={prefs.cats.includes(NO_CAT)} className={chip(prefs.cats.includes(NO_CAT))}>
                  No category <span className="text-slate-500">{catOptions.none}</span>
                </button>
              )}
            </div>
          )}
          {statusOn && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Project task status">
              <span className="mr-1 text-xs text-slate-500">Project task status</span>
              <button onClick={() => update({ statuses: [] })} aria-pressed={!prefs.statuses.length} className={chip(!prefs.statuses.length)}>All statuses</button>
              {PT_STATUSES.map(s => (
                <button key={s.key} onClick={() => toggleIn('statuses', s.key)} aria-pressed={prefs.statuses.includes(s.key)} className={chip(prefs.statuses.includes(s.key))}>
                  {s.label} <span className="text-slate-500">{statusCounts[s.key] ?? 0}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error ? <p className="text-sm text-rose-400">{error}</p> : !items ? (
        <div className="h-64 animate-pulse rounded-2xl bg-slate-800/40" />
      ) : (
        <>
          <p className="mb-2 text-xs text-slate-500">
            {list.length} item{list.length === 1 ? '' : 's'}
            {filtered && <> · <button onClick={() => { update({ types: [], period: 'all', society: 0, cats: [], statuses: [] }); setQ(''); }} className="text-blue-400 hover:underline">Clear filters</button></>}
            {failed.length > 0 && <span className="text-amber-300"> · Some {failed.map(f => TYPE[f as TypeKey]?.label ?? f).join(', ')} couldn’t be loaded.</span>}
          </p>
          {!list.length ? (
            <div className="rounded-2xl border border-slate-800 bg-dr-card p-10 text-center text-sm text-slate-500">
              {items.length ? 'Nothing matches these filters.' : 'Nothing yet. Take part in a Society and what you do will be listed here.'}
            </div>
          ) : prefs.view === 'list' ? (
            <ul data-stuff-list className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-dr-card">
              {list.slice(0, shown).map(i => <Row key={i.key} i={i} isNew={!!lastVisit && new Date(i.at).getTime() > lastVisit} colour={i.society ? colour.get(i.society.id) : undefined} />)}
            </ul>
          ) : (
            <div data-stuff-list className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {list.slice(0, shown).map(i => <Tile key={i.key} i={i} isNew={!!lastVisit && new Date(i.at).getTime() > lastVisit} colour={i.society ? colour.get(i.society.id) : undefined} />)}
            </div>
          )}
          {list.length > shown && (
            <div className="mt-4 text-center">
              <button onClick={() => setShown(n => n + 200)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500">Show more ({list.length - shown} left)</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NewDot() {
  return <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-blue-400 align-middle" title="New since your last visit" aria-label="New" />;
}

function SocietyTag({ s, colour }: { s: Item['society']; colour?: string }) {
  if (!s) return null;
  const c = colour ?? '#64748b';
  return (
    <span className="inline-block max-w-[14rem] truncate whitespace-nowrap rounded-full border px-2 py-px text-[11px] font-medium"
      style={{ color: c, borderColor: `${c}66`, backgroundColor: `${c}1a` }} title={s.name}>{s.name}</span>
  );
}
function Cats({ cats }: { cats?: Cat[] }) {
  if (!cats?.length) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {cats.map(c => (
        <span key={c.name} className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-slate-400">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />{c.name}
        </span>
      ))}
    </span>
  );
}
function Role({ role }: { role: string }) {
  return <span className={`whitespace-nowrap rounded-full border px-2 py-px text-[11px] ${ROLE_TONE[role] ?? 'border-slate-600 text-slate-300'}`}>{role}</span>;
}

function Row({ i, colour, isNew }: { i: Item; colour?: string; isNew: boolean }) {
  const t = TYPE[i.type];
  return (
    <li>
      <Link href={i.href} className="flex flex-col gap-1 px-4 py-2.5 hover:bg-slate-800/40 sm:flex-row sm:items-center sm:gap-3">
        <span className="flex w-32 flex-shrink-0 items-center gap-1.5 text-xs text-slate-400"><span aria-hidden>{t?.icon}</span>{t?.label}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-slate-100">{isNew && <NewDot />}{i.title}</span>
          {i.sub && <span className="block truncate text-xs text-slate-500">{i.sub}</span>}
        </span>
        <span className="flex flex-shrink-0 flex-wrap items-center gap-2">
          <Cats cats={i.cats} />
          {i.status && <Role role={PT_LABEL[i.status] ?? i.status} />}
          <Role role={i.role} />
          <SocietyTag s={i.society} colour={colour} />
          <span className="w-16 text-right text-xs text-slate-500">{when(i.at)}</span>
        </span>
      </Link>
    </li>
  );
}

function Tile({ i, colour, isNew }: { i: Item; colour?: string; isNew: boolean }) {
  const t = TYPE[i.type];
  return (
    <Link href={i.href} className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-dr-card p-4 hover:border-slate-600"
      style={colour ? { borderTopColor: colour, borderTopWidth: 3 } : undefined}>
      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><span aria-hidden>{t?.icon}</span>{t?.label}</span>
        <span>{when(i.at)}</span>
      </div>
      <p className="line-clamp-2 text-sm font-medium text-slate-100">{isNew && <NewDot />}{i.title}</p>
      {i.sub && <p className="line-clamp-3 text-xs text-slate-500">{i.sub}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1"><Cats cats={i.cats} />{i.status && <Role role={PT_LABEL[i.status] ?? i.status} />}<Role role={i.role} /><SocietyTag s={i.society} colour={colour} /></div>
    </Link>
  );
}
