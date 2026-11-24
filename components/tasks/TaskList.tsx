'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSecureAccess } from '@/components/sealed/useSecureAccess';
import { listKeys, openItemText, type ItemKeys } from '@/components/sealed/items';
import TaskEditor from './TaskEditor';
import TaskPreview from './TaskPreview';
import ConvertDialog from './ConvertDialog';
import SwatchManager from './Managers';
import {
  Chip, fmtDay, overdue, plain, send, smallInput, TASK_STATUS, taskNo,
  type ProjectTask, type QuickTask, type Swatch, type TasksData,
} from './shared';

type Show = 'mine' | 'tasks' | 'shared' | 'project-mine' | 'project-all' | 'all';
type SortKey = 'ref' | 'title' | 'type' | 'owner' | 'status' | 'priority' | 'due' | 'updated';
type Filters = { show: Show; statuses: string[]; priorities: string[]; categories: string[]; project: string; dueBy: string; overdue: boolean; q: string };
type Sort = { key: SortKey; dir: 1 | -1 };

const SHOW: { v: Show; label: string }[] = [
  { v: 'mine', label: 'My tasks + Project Tasks assigned to me' },
  { v: 'tasks', label: 'My tasks' },
  { v: 'shared', label: 'Tasks shared with me' },
  { v: 'project-mine', label: 'Project Tasks assigned to me' },
  { v: 'project-all', label: 'All Project Tasks' },
  { v: 'all', label: 'Everything I can see' },
];
const OPEN = ['new', 'in_progress', 'paused'];
const DEFAULT_FILTERS: Filters = { show: 'mine', statuses: OPEN, priorities: [], categories: [], project: '', dueBy: '', overdue: false, q: '' };
const DEFAULT_SORT: Sort = { key: 'due', dir: 1 };
const STATUS_ORDER = ['new', 'in_progress', 'paused', 'complete'];

type Row = {
  key: string; kind: 'task' | 'project'; id: string; ref: string; title: string; locked: boolean;
  status: string; priority: Swatch | null; prioRank: number; due: string | null; updated: string;
  categories: string[]; text: string; mine: boolean; assignedToMe: boolean; projectId: string | null; note: string;
  owner: string; shared: boolean;   // whose it is ('You', @author, or a Project Task's assignees); mine and visible to others
  q?: QuickTask; p?: ProjectTask;
};

function readSaved(key: string): { filters: Filters; sort: Sort } {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (v?.filters && v?.sort) return { filters: { ...DEFAULT_FILTERS, ...v.filters }, sort: v.sort };
  } catch { /* none saved, or storage blocked */ }
  return { filters: DEFAULT_FILTERS, sort: DEFAULT_SORT };
}

// A dropdown of tick boxes (categories, priorities); closes on a click elsewhere
function MultiPick({ label, options, value, onChange }: {
  label: string; options: { id: string; name: string; color?: string }[]; value: string[]; onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className={`${smallInput} ${value.length ? 'border-blue-500/60 text-blue-200' : 'text-slate-300'}`}>
        {label}: {value.length ? `${value.length} chosen` : 'All'} ▾
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 max-h-72 w-56 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-xl">
          {!options.length && <p className="px-2 py-1.5 text-xs text-slate-500">None yet</p>}
          {options.map(o => (
            <label key={o.id} className="flex items-center gap-2 rounded px-2 py-1 text-xs text-slate-200 hover:bg-slate-800">
              <input type="checkbox" checked={value.includes(o.id)} className="accent-blue-500"
                onChange={() => onChange(value.includes(o.id) ? value.filter(x => x !== o.id) : [...value, o.id])} />
              {o.color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} />}
              <span className="truncate">{o.name}</span>
            </label>
          ))}
          {value.length > 0 && <button type="button" onClick={() => onChange([])} className="w-full rounded px-2 py-1 text-left text-xs text-blue-300 hover:bg-slate-800">Clear</button>}
        </div>
      )}
    </div>
  );
}

export default function TaskList({ societyId }: { societyId: number }) {
  const base = `/api/societies/${societyId}/tasks`;
  const storeKey = `nv-tasks:${societyId}`;
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = useState<TasksData | null>(null);
  const [error, setError] = useState('');
  const [{ filters, sort }, setView] = useState<{ filters: Filters; sort: Sort }>({ filters: DEFAULT_FILTERS, sort: DEFAULT_SORT });
  const [quick, setQuick] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<QuickTask | 'new' | null>(null);
  const [preview, setPreview] = useState<{ kind: 'task'; t: QuickTask } | { kind: 'project'; t: ProjectTask } | null>(null);
  const [converting, setConverting] = useState<QuickTask | null>(null);
  const [managing, setManaging] = useState<'categories' | 'priorities' | null>(null);
  const [notice, setNotice] = useState<{ text: string; href?: string } | null>(null);

  // The saved view (this browser only)
  useEffect(() => { setView(readSaved(storeKey)); }, [storeKey]);
  const update = (f: Partial<Filters>, s?: Sort) => setView(v => {
    const next = { filters: { ...v.filters, ...f }, sort: s ?? v.sort };
    try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* storage blocked */ }
    return next;
  });

  const load = useCallback(async () => {
    const r = await fetch(base);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error ?? 'Couldn’t load your tasks'); return; }
    setData(d); setError('');
  }, [base]);
  useEffect(() => { void load(); }, [load]);

  // Sealed projects' tasks: opened with this person's keys
  const access = useSecureAccess();
  const [pkeys, setPkeys] = useState<Map<string, ItemKeys> | null>(null);
  const anySealed = !!data?.projectTasks.some(p => p.protection === 'sealed');
  useEffect(() => {
    if (!anySealed || access.status !== 'ready' || !access.identity || pkeys) return;
    listKeys(`/api/societies/${societyId}`, 'project', access.identity).then(setPkeys).catch(() => {});
  }, [anySealed, access.status, access.identity, pkeys, societyId]);

  const projectTasks = useMemo(() => (data?.projectTasks ?? []).map(p => {
    if (p.protection !== 'sealed') return p;
    const k = pkeys?.get(p.project_id);
    const o = (v: string | null) => { try { return openItemText(k, v); } catch { return null; } };
    const name = o(p.name);
    return { ...p, name: name ?? 'Sealed task', project: o(p.project) ?? 'Sealed project', description: o(p.description), comments: o(p.comments), locked: name == null };
  }), [data?.projectTasks, pkeys]);

  const rows: Row[] = useMemo(() => {
    if (!data) return [];
    const prio = new Map(data.priorities.map((p, i) => [p.id, { p, i }]));
    return [
      ...data.tasks.map((t): Row => ({
        key: `t:${t.id}`, kind: 'task', id: t.id, ref: taskNo(t.number), title: t.name, locked: false,
        status: t.status, priority: prio.get(t.priority_id ?? '')?.p ?? null, prioRank: prio.get(t.priority_id ?? '')?.i ?? 999,
        due: t.due_date, updated: t.updated_at ?? t.created_at, categories: t.categories,
        text: `${t.name} ${plain(t.description)} ${plain(t.notes)} ${t.owner ?? ''}`.toLowerCase(),
        mine: t.mine, assignedToMe: false, projectId: null,
        note: t.mine ? (t.shared_all ? 'Shared with everyone' : t.shares?.length ? `Shared with ${t.shares.map(s => '@' + s.handle).join(', ')}` : '') : data.readOnly ? 'Shared with everyone' : 'Shared with you',
        owner: t.mine ? 'You' : `@${t.owner ?? 'unknown'}`, shared: t.mine && (t.shared_all || !!t.shares?.length),
        q: t,
      })),
      ...projectTasks.map((p): Row => ({
        key: `p:${p.id}`, kind: 'project', id: p.id, ref: p.project, title: p.name, locked: !!p.locked,
        status: p.status, priority: null, prioRank: 999, due: p.due_date, updated: p.updated_at ?? p.created_at, categories: p.categories,
        text: `${p.name} ${plain(p.description)} ${p.comments ?? ''} ${p.project}`.toLowerCase(),
        mine: false, assignedToMe: p.assigned_to_me, projectId: p.project_id,
        note: '',
        owner: p.assignees.length ? p.assignees.map(a => a.id === data.me ? 'You' : '@' + a.handle).join(', ') : 'Unassigned', shared: false,
        p,
      })),
    ];
  }, [data, projectTasks]);

  const shown = useMemo(() => {
    const f = data?.readOnly ? { ...filters, show: 'all' as Show } : filters;   // demo visitors have nothing of their own
    const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
    const today = new Date(); const tk = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const list = rows.filter(r => {
      const show = f.show === 'all' || (f.show === 'mine' && (r.kind === 'task' ? r.mine : r.assignedToMe))
        || (f.show === 'tasks' && r.kind === 'task' && r.mine) || (f.show === 'shared' && r.kind === 'task' && !r.mine)
        || (f.show === 'project-mine' && r.kind === 'project' && r.assignedToMe) || (f.show === 'project-all' && r.kind === 'project');
      if (!show) return false;
      if (f.statuses.length && !f.statuses.includes(r.status)) return false;
      if (f.priorities.length && !(r.priority && f.priorities.includes(r.priority.id))) return false;
      if (f.categories.length && !r.categories.some(c => f.categories.includes(c))) return false;
      if (f.project && r.projectId !== f.project) return false;
      if (f.dueBy && !(r.due && r.due <= f.dueBy)) return false;
      if (f.overdue && !(r.due && r.due < tk && r.status !== 'complete')) return false;
      return words.every(w => r.text.includes(w) || r.ref.toLowerCase().includes(w));
    });
    const cmp = (a: Row, b: Row): number => {
      const d = sort.dir;
      switch (sort.key) {
        case 'due': if (a.due !== b.due) { if (!a.due) return 1; if (!b.due) return -1; return a.due < b.due ? -d : d; } break;
        case 'priority': if (a.prioRank !== b.prioRank) { if (a.prioRank === 999) return 1; if (b.prioRank === 999) return -1; return (a.prioRank - b.prioRank) * d; } break;
        case 'status': if (a.status !== b.status) return (STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)) * d; break;
        case 'title': { const c = a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }); if (c) return c * d; break; }
        case 'type': if (a.kind !== b.kind) return (a.kind === 'task' ? -1 : 1) * d; break;
        case 'owner': { const c = a.owner.localeCompare(b.owner, 'en', { sensitivity: 'base' }); if (c) return c * d; break; }
        case 'updated': if (a.updated !== b.updated) return (a.updated < b.updated ? -1 : 1) * d; break;
        case 'ref': { const c = a.ref.localeCompare(b.ref, 'en', { numeric: true }); if (c) return c * d; break; }
      }
      // Then: earliest due, highest priority, lowest number
      if (a.due !== b.due) { if (!a.due) return 1; if (!b.due) return -1; return a.due < b.due ? -1 : 1; }
      if (a.prioRank !== b.prioRank) return a.prioRank - b.prioRank;
      return a.ref.localeCompare(b.ref, 'en', { numeric: true });
    };
    return list.sort(cmp);
  }, [rows, filters, sort, data?.readOnly]);

  // ?task=<id>: open it (from the Calendar, a reference or the abuse queue)
  const taskParam = params.get('task');
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!data || !taskParam || opened.current === taskParam) return;
    opened.current = taskParam;
    const t = data.tasks.find(x => x.id === taskParam);
    if (t) { if (t.mine) setEditing(t); else setPreview({ kind: 'task', t }); }
    else setNotice({ text: 'That task has been deleted, converted, or isn’t shared with you.' });
  }, [data, taskParam]);
  const closeParam = () => { if (taskParam) router.replace(`/society/${societyId}/tasks`); };

  function open(r: Row) {
    if (r.q?.mine) setEditing(r.q);
    else if (r.q) setPreview({ kind: 'task', t: r.q });
    else if (r.p) setPreview({ kind: 'project', t: r.p });
  }
  async function addQuick(e: React.FormEvent) {
    e.preventDefault();
    if (!quick.trim() || adding) return;
    setAdding(true);
    const r = await send(base, 'POST', { name: quick });
    setAdding(false);
    if (!r.ok) { setError(String(r.data.error ?? 'Couldn’t add it')); return; }
    setQuick(''); void load();
  }
  async function setStatus(t: QuickTask, status: string) {
    setData(d => d && { ...d, tasks: d.tasks.map(x => x.id === t.id ? { ...x, status } : x) });
    const r = await send(`${base}/${t.id}`, 'PATCH', { status });
    if (!r.ok) setError(String(r.data.error ?? 'Couldn’t change it'));
    void load();
  }
  const sortBy = (key: SortKey) => update({}, { key, dir: sort.key === key ? (sort.dir === 1 ? -1 : 1) : 1 });
  const toggleStatus = (s: string) => update({ statuses: filters.statuses.includes(s) ? filters.statuses.filter(x => x !== s) : [...filters.statuses, s] });

  // How many of your tasks / project tasks carry each of your categories (and how many aren't complete)
  const categoryCounts = useMemo(() => {
    const c: Record<string, { n: number; open: number }> = {};
    for (const t of [...(data?.tasks.filter(x => x.mine) ?? []), ...(data?.projectTasks ?? [])])
      for (const id of t.categories) { const e = c[id] ?? (c[id] = { n: 0, open: 0 }); e.n++; if (t.status !== 'complete') e.open++; }
    return c;
  }, [data]);
  if (!data) return error ? <p className="text-sm text-rose-400">{error}</p> : <div className="h-40 animate-pulse rounded-2xl bg-slate-800/40" />;

  const catById = new Map(data.categories.map(c => [c.id, c]));
  const projects = [...new Map(projectTasks.map(p => [p.project_id, p.project])).entries()];
  const showsProjects = filters.show !== 'tasks' && filters.show !== 'shared';
  const filtered = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  const head = (k: SortKey, children: React.ReactNode, cls = '') => (
    <th key={k} scope="col" className={`px-2 py-2 text-left font-semibold ${cls}`} aria-sort={sort.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => sortBy(k)} className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-slate-200 ${sort.key === k ? 'text-slate-200' : ''}`}>
        {children}<span aria-hidden className="text-[9px]">{sort.key === k ? (sort.dir === 1 ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      {editing && (
        <TaskEditor society={societyId} me={data.me ?? ''} task={editing === 'new' ? null : editing} priorities={data.priorities} categories={data.categories}
          canConvert={data.projectsOn}
          onSaved={() => { setEditing(null); closeParam(); void load(); }} onClose={() => { setEditing(null); closeParam(); }}
          onConvert={t => { setEditing(null); setConverting(t); }} />
      )}
      {preview && (
        <TaskPreview society={societyId} item={preview} priorities={data.priorities} categories={data.categories} readOnly={data.readOnly}
          onClose={() => { setPreview(null); closeParam(); }} onChanged={() => void load()} />
      )}
      {converting && (
        <ConvertDialog society={societyId} task={converting} targets={data.convertTargets} onClose={() => setConverting(null)}
          onDone={pid => { setConverting(null); closeParam(); setNotice({ text: 'Converted to a project task.', href: `/society/${societyId}/projects/${pid}` }); void load(); }} />
      )}
      {managing === 'categories' && (
        <SwatchManager title="Your categories" url={`${base}/categories`} items={data.categories} onChanged={() => void load()} onClose={() => setManaging(null)}
          counts={categoryCounts} countNote="your tasks and project tasks"
          intro="Your own labels for sorting your tasks and Project Tasks. Only you see them." />
      )}
      {managing === 'priorities' && (
        <SwatchManager title="Society priorities" url={`${base}/priorities`} items={data.priorities} onChanged={() => void load()} onClose={() => setManaging(null)} min={1}
          counts={data.priorityCounts} countNote="every member’s tasks in this Society"
          intro="The priorities everyone in this Society can give their tasks, highest first." />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 basis-64">
          <h2 className="text-lg font-semibold text-slate-100">Tasks</h2>
          {data.readOnly ? (
            <p className="text-sm text-slate-400">A personal space for each member to manage their own tasks, private to them by default, with an option to share
              them or convert one into a shared project task. Here you can look at the tasks shared with everyone and the project tasks.
              Join a Society to keep your own.</p>
          ) : (
            <p className="text-sm text-slate-400">A personal space to manage your own tasks. Private to you only by default, with an option to share or convert to a shared project task.</p>
          )}
        </div>
        {!data.readOnly && <>
          <button onClick={() => setManaging('categories')} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500">Categories</button>
          {data.canManagePriorities && <button onClick={() => setManaging('priorities')} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500">Priorities</button>}
          <button onClick={() => setEditing('new')} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500">+ New task</button>
        </>}
      </div>

      {!data.readOnly && <form onSubmit={addQuick} className="flex gap-2">
        <input value={quick} onChange={e => setQuick(e.target.value)} maxLength={300} placeholder="Add a task: type it and press Enter"
          aria-label="Quick add a task" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none" />
        <button type="submit" disabled={!quick.trim() || adding} className="rounded-lg border border-slate-600 px-3 text-sm text-slate-200 hover:border-blue-500/60 disabled:opacity-40">Add</button>
      </form>}

      {notice && (
        <p className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">
          <span className="flex-1">{notice.text}{notice.href && <> <a href={notice.href} className="underline hover:text-emerald-200">Open the project →</a></>}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss">✕</button>
        </p>
      )}
      {error && <p className="text-sm text-rose-400">{error}</p>}

      {/* Filters */}
      <div className="space-y-2 rounded-xl border border-slate-800 bg-dr-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          {!data.readOnly && <>
            <select value={filters.show} onChange={e => update({ show: e.target.value as Show })} aria-label="Show" className={smallInput}>
              {SHOW.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>
            <MultiPick label="Category" options={data.categories} value={filters.categories} onChange={v => update({ categories: v })} />
          </>}
          <MultiPick label="Priority" options={data.priorities} value={filters.priorities} onChange={v => update({ priorities: v })} />
          {showsProjects && projects.length > 0 && (
            <select value={filters.project} onChange={e => update({ project: e.target.value })} aria-label="Project" className={smallInput}>
              <option value="">All projects</option>
              {projects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          )}
          <label className="flex items-center gap-1 text-xs text-slate-400">Due by
            <input type="date" value={filters.dueBy} onChange={e => update({ dueBy: e.target.value })} className={smallInput} /></label>
          <button type="button" onClick={() => update({ overdue: !filters.overdue })} aria-pressed={filters.overdue}
            className={`rounded-lg border px-2 py-1.5 text-xs ${filters.overdue ? 'border-rose-500/60 bg-rose-500/10 text-rose-300' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}>Overdue</button>
          <input value={filters.q} onChange={e => update({ q: e.target.value })} placeholder="Search…" aria-label="Search" className={`${smallInput} min-w-[8rem] flex-1`} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500">Status:</span>
          {STATUS_ORDER.map(s => (
            <button key={s} type="button" onClick={() => toggleStatus(s)} aria-pressed={filters.statuses.includes(s)}
              className={`rounded-full border px-2.5 py-0.5 ${filters.statuses.includes(s) ? TASK_STATUS[s].cls : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}>
              {TASK_STATUS[s].label}
            </button>
          ))}
          <span className="ml-auto text-slate-500">{shown.length} task{shown.length === 1 ? '' : 's'}</span>
          {filtered && <button type="button" onClick={() => update(DEFAULT_FILTERS)} className="text-blue-300 hover:text-blue-200">Reset filters</button>}
        </div>
      </div>

      {!shown.length ? (
        <p className="rounded-2xl border border-slate-800 bg-dr-card p-8 text-center text-sm text-slate-500">
          {rows.length ? 'No tasks match these filters.' : data.readOnly ? 'No tasks have been shared here yet.' : 'No tasks yet. Add one above: only you see it unless you share it.'}
        </p>
      ) : (
        <>
          {/* Wide screens: a sortable table */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-800 bg-dr-card md:block">
            <table className="w-full table-fixed text-sm">
              <thead className="border-b border-slate-800 text-[11px] text-slate-500">
                <tr>
                  {head('ref', '#', 'w-28')}
                  {head('title', 'Title')}
                  {head('type', 'Type', 'w-28')}
                  {head('owner', 'Owner', 'w-32')}
                  {head('status', 'Status', 'w-32')}
                  {head('priority', 'Priority', 'w-24')}
                  {head('due', 'Due', 'w-28')}
                  <th scope="col" className="w-44 px-2 py-2 text-left font-semibold uppercase tracking-wider">Categories</th>
                  {head('updated', 'Updated', 'w-24')}
                </tr>
              </thead>
              <tbody>
                {shown.map(r => {
                  const desc = r.q ? plain(r.q.description) : plain(r.p?.description ?? null);
                  return (
                    <tr key={r.key} onClick={() => open(r)} className="cursor-pointer border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                      <td className="truncate px-2 py-2 font-mono text-xs text-slate-500" title={r.kind === 'project' ? r.ref : undefined}>{r.kind === 'task' ? r.ref : r.ref}</td>
                      <td className="px-2 py-2" title={desc || undefined}>
                        <span className="block truncate font-medium text-slate-100">{r.locked && '🔐 '}{r.title}</span>
                        <span className="block truncate text-[11px] text-slate-500">{[r.note, desc].filter(Boolean).join(' · ')}</span>
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-400">{r.kind === 'task' ? 'Task' : 'Project Task'}</td>
                      <td className={`truncate px-2 py-2 text-xs ${r.owner === 'You' ? 'text-slate-300' : 'font-medium text-violet-300'}`} title={r.kind === 'project' ? `Assigned to ${r.owner}` : r.shared ? r.note : undefined}>
                        {r.owner}{r.shared && <span className="ml-1" aria-label="shared" title={r.note}>👥</span>}
                      </td>
                      <td className="px-2 py-2" onClick={e => r.q?.mine && e.stopPropagation()}>
                        {r.q?.mine ? (
                          <select value={r.status} onChange={e => setStatus(r.q!, e.target.value)} aria-label={`Status of ${r.title}`}
                            className={`rounded-full border px-2 py-0.5 text-xs ${TASK_STATUS[r.status]?.cls ?? ''} bg-transparent`}>
                            {STATUS_ORDER.map(s => <option key={s} value={s} className="bg-slate-900 text-slate-200">{TASK_STATUS[s].label}</option>)}
                          </select>
                        ) : <span className={`rounded-full border px-2 py-0.5 text-xs ${TASK_STATUS[r.status]?.cls ?? ''}`}>{TASK_STATUS[r.status]?.label ?? r.status}</span>}
                      </td>
                      <td className="px-2 py-2">{r.priority ? <Chip s={r.priority} /> : <span className="text-slate-600">—</span>}</td>
                      <td className={`px-2 py-2 text-xs ${overdue(r.due, r.status) ? 'font-semibold text-rose-400' : 'text-slate-300'}`}>{fmtDay(r.due) || <span className="text-slate-600">—</span>}</td>
                      <td className="px-2 py-2"><div className="flex flex-wrap gap-1">{r.categories.map(c => catById.get(c)).filter(Boolean).map(c => <Chip key={c!.id} s={c!} />)}</div></td>
                      <td className="px-2 py-2 text-xs text-slate-500">{fmtDay(r.updated.slice(0, 10))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Phones: cards, with the sort as a menu */}
          <div className="space-y-2 md:hidden">
            <label className="flex items-center gap-2 text-xs text-slate-400">Sort by
              <select value={`${sort.key}:${sort.dir}`} onChange={e => { const [k, d] = e.target.value.split(':'); update({}, { key: k as SortKey, dir: Number(d) as 1 | -1 }); }} className={smallInput}>
                {([['due', 'Due date'], ['priority', 'Priority'], ['status', 'Status'], ['owner', 'Owner'], ['title', 'Title'], ['updated', 'Last updated'], ['ref', 'Number']] as const).flatMap(([k, l]) => [
                  <option key={`${k}:1`} value={`${k}:1`}>{l} ↑</option>, <option key={`${k}:-1`} value={`${k}:-1`}>{l} ↓</option>])}
              </select>
            </label>
            {shown.map(r => (
              <button key={r.key} onClick={() => open(r)} className="block w-full rounded-xl border border-slate-800 bg-dr-card px-3 py-2.5 text-left hover:bg-slate-800/30">
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">{r.locked && '🔐 '}{r.title}</span>
                  <span className={`text-[11px] ${overdue(r.due, r.status) ? 'font-semibold text-rose-400' : 'text-slate-400'}`}>{fmtDay(r.due)}</span>
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="font-mono">{r.kind === 'task' ? r.ref : `Project · ${r.ref}`}</span>
                  <span className={r.owner === 'You' ? '' : 'font-medium text-violet-300'}>{r.owner}{r.shared && ' 👥'}</span>
                  <span className={`rounded-full border px-1.5 ${TASK_STATUS[r.status]?.cls ?? ''}`}>{TASK_STATUS[r.status]?.label}</span>
                  {r.priority && <Chip s={r.priority} />}
                  {r.categories.map(c => catById.get(c)).filter(Boolean).map(c => <Chip key={c!.id} s={c!} />)}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
