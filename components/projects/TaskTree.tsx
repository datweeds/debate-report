'use client';

import ReportButton from '@/components/ReportButton';
import { Fragment, useEffect, useState } from 'react';
import RichText from '@/components/discussions/RichText';
import { Badge, fmtDate, inputCls, openFor, send, Sheet, TASK_STATUS, todayKey, type Member } from './shared';
import DocViewer from '@/components/documents/DocViewer';
import { DEP_KINDS, DEP_LABEL, depProblem, earliestStart, family, type Dep, type DepKind } from './deps';

export type Report = { body: string; status: string; created_at: string; by: string | null };
export type Task = {
  id: string; parent_id: string | null; sort_order: number; name: string; description: string | null;
  status: 'new' | 'in_progress' | 'paused' | 'complete'; comments: string | null;
  start_date: string | null; end_date: string | null; due_date: string | null;
  assignees: { id: string; handle: string; name: string | null }[];
  latest_report: Report | null; report_count: number;
  document_id: string | null; doc_kind: 'file' | 'link' | 'note' | null; doc_title: string | null; doc_file_name: string | null; doc_mime: string | null;
  doc_protection?: 'server' | 'sealed' | null; doc_folder?: string | null;
  dependencies: Dep[];
  group_id: string | null;
};

export type TaskGroup = { id: string; name: string; sort_order: number };
export type Section = { group: TaskGroup | null; roots: TreeNode[] };

// Top-level tasks (with their sub-tasks) by group, in the groups' order, then
// the ungrouped ones. Without groups: one section, no group.
export function sections(tasks: Task[], groups: TaskGroup[]): Section[] {
  const roots = buildTree(tasks);
  if (!groups.length) return [{ group: null, roots }];
  const known = new Set(groups.map(g => g.id));
  const out: Section[] = groups.map(g => ({ group: g, roots: roots.filter(t => t.group_id === g.id) }));
  const loose = roots.filter(t => !t.group_id || !known.has(t.group_id));
  if (loose.length) out.push({ group: null, roots: loose });
  return out;
}

// Every task in a section, sub-tasks included
export const allIn = (roots: TreeNode[]) => flatten(roots);

// Each of a task's dependencies whose dates disagree, in words
export function depProblems(t: Task, byId: Map<string, Task>): string[] {
  return (t.dependencies ?? []).flatMap(d => {
    const other = byId.get(d.task_id);
    const p = other ? depProblem(t, other, d.kind) : null;
    return p ? [p] : [];
  });
}

// "after X finishes, after Y starts"
export function depSummary(t: Task, byId: Map<string, Task>): string {
  return (t.dependencies ?? []).map(d => `after “${byId.get(d.task_id)?.name ?? '?'}” ${DEP_LABEL[d.kind]}`).join(', ');
}

type DocOption = { id: string; kind: 'file' | 'link' | 'note'; title: string; file_name: string | null; mime_type: string | null; folder: string };
const societyBaseOf = (base: string) => base.replace(/\/projects\/[^/]+$/, '');

// The task's linked document: a file opens in the viewer, a link in a new tab
function TaskDocLink({ base, task, onOpen, compact }: { base: string; task: Task; onOpen: (t: Task) => void; compact?: boolean }) {
  if (!task.document_id) return null;
  const label = task.doc_title || task.doc_file_name || 'Document';
  const cls = compact
    ? 'max-w-[12rem] truncate rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[11px] text-sky-300 hover:bg-sky-500/20'
    : 'inline-flex max-w-full items-center gap-1.5 truncate rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-sm text-sky-200 hover:bg-sky-500/20';
  // In a sealed folder: it can only be opened where its key is, on the Documents page
  const docsPage = `${societyBaseOf(base).replace('/api/societies/', '/society/')}/documents`;
  if (task.doc_protection === 'sealed') {
    const q = [task.doc_folder ? `folder=${task.doc_folder}` : '', task.doc_kind === 'note' ? `note=${task.document_id}` : ''].filter(Boolean).join('&');
    return <a href={`${docsPage}${q ? `?${q}` : ''}`} className={cls} title="Open it in its sealed folder">🔐 {label}</a>;
  }
  if (task.doc_kind === 'note') {
    return <a href={`${docsPage}?note=${task.document_id}`} className={cls} title={`Open the note ${label}`}>📝 {label}</a>;
  }
  if (task.doc_kind === 'link') {
    return <a href={`${societyBaseOf(base)}/documents/${task.document_id}/open`} target="_blank" rel="noopener noreferrer" className={cls} title={`Open ${label} in a new tab`}>🔗 {label}</a>;
  }
  return <button type="button" onClick={() => onOpen(task)} className={cls} title={`Open ${label}`}>📎 {label}</button>;
}

export type TreeNode = Task & { depth: number; children: TreeNode[] };

// Tasks arranged as a tree, in display order.
export function buildTree(tasks: Task[]): TreeNode[] {
  const byParent = new Map<string | null, Task[]>();
  for (const t of tasks) {
    const k = t.parent_id ?? null;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(t);
  }
  const make = (parent: string | null, depth: number): TreeNode[] =>
    (byParent.get(parent) ?? []).sort((a, b) => a.sort_order - b.sort_order)
      .map(t => ({ ...t, depth, children: make(t.id, depth + 1) }));
  return make(null, 0);
}

export function flatten(nodes: TreeNode[], collapsed?: Set<string>): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (ns: TreeNode[]) => ns.forEach(n => { out.push(n); if (!collapsed?.has(n.id)) walk(n.children); });
  walk(nodes);
  return out;
}

export const isOverdue = (t: Task) => t.status !== 'complete' && !!t.due_date && t.due_date < todayKey();

// ── The tree ─────────────────────────────────────────────────────────────────

export default function TaskTree({ base, tasks, groups, me, canManage, onChanged, open, setOpen, shownIds }: {
  base: string; tasks: Task[]; groups: TaskGroup[]; me: string | null; canManage: boolean; onChanged: () => void;
  open: string | null; setOpen: (id: string | null) => void;   // the task whose sheet is showing
  shownIds?: Set<string> | null;   // filtered: only these (null: all)
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState<{ parentId: string | null; groupId?: string | null } | null>(null);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<Task | null>(null);   // a task's document, open in the viewer
  const secs = sections(shownIds ? tasks.filter(t => shownIds.has(t.id)) : tasks, groups)
    .filter(sec => !shownIds || sec.roots.length > 0);   // filtered: hide groups with nothing to show
  const byId = new Map(tasks.map(t => [t.id, t]));
  const openTask = tasks.find(t => t.id === open) ?? null;

  const allocated = (t: Task) => !!me && t.assignees.some(a => a.id === me);

  const toggle = (key: string) => setCollapsed(s => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  async function groupAction(g: TaskGroup, action: 'rename' | 'up' | 'down' | 'delete') {
    let err: string | null = null;
    if (action === 'rename') {
      const name = prompt('Rename the group', g.name)?.trim();
      if (!name || name === g.name) return;
      err = await send(`${base}/groups/${g.id}`, 'PATCH', { name });
    } else if (action === 'delete') {
      if (!confirm(`Delete the group “${g.name}”? Its project tasks are kept, ungrouped.`)) return;
      err = await send(`${base}/groups/${g.id}`, 'DELETE');
    } else err = await send(`${base}/groups/${g.id}`, 'PATCH', { move: action });
    if (err) setError(err); else onChanged();
  }

  async function addGroup() {
    const name = prompt('Name of the new Task Group')?.trim();
    if (!name) return;
    const err = await send(`${base}/groups`, 'POST', { name });
    if (err) setError(err); else onChanged();
  }

  // A group's progress and dates, for its header
  function groupSummary(roots: TreeNode[]) {
    const all = allIn(roots);
    const starts = all.map(t => t.start_date ?? t.end_date ?? t.due_date).filter(Boolean) as string[];
    const ends = all.map(t => t.end_date ?? t.due_date ?? t.start_date).filter(Boolean) as string[];
    return {
      done: all.filter(t => t.status === 'complete').length, total: all.length,
      from: starts.length ? starts.reduce((a, b) => a < b ? a : b) : null, to: ends.length ? ends.reduce((a, b) => a > b ? a : b) : null,
    };
  }

  async function setStatus(t: Task, status: string) {
    const err = await send(`${base}/tasks/${t.id}`, 'PATCH', { status });
    if (err) setError(err); else onChanged();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {canManage ? 'Add tasks and sub-tasks, and allocate members to them.' : 'Tasks allocated to you can be updated and reported on.'}
        </p>
        {canManage && (
          <span className="flex gap-2">
            <button onClick={addGroup} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500">+ Add group</button>
            <button onClick={() => setCreating({ parentId: null })} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500">+ Add project task</button>
          </span>
        )}
      </div>
      {error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}

      {tasks.length === 0 && groups.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-dr-card p-10 text-center text-sm text-slate-500">No project tasks yet.</div>
      ) : shownIds && shownIds.size === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-dr-card p-10 text-center text-sm text-slate-500">No project tasks match these filters.</div>
      ) : (
        <ul className="divide-y divide-slate-800/60 overflow-hidden rounded-2xl border border-slate-800 bg-dr-card">
          {secs.map(sec => {
            const key = `g:${sec.group?.id ?? 'none'}`;
            const shut = collapsed.has(key);
            const sum = groupSummary(sec.roots);
            return (
            <Fragment key={key}>
              {groups.length > 0 && (
                <li className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-slate-800/40 px-3 py-2">
                  <button onClick={() => toggle(key)} className="w-4 text-xs text-slate-400 hover:text-slate-100" aria-label={shut ? 'Expand group' : 'Collapse group'}>{shut ? '▸' : '▾'}</button>
                  <button onClick={() => toggle(key)} className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-slate-100">
                    {sec.group?.name ?? 'Ungrouped'}
                    <span className="ml-2 text-[11px] font-normal text-slate-500">
                      {sum.total ? `${sum.done}/${sum.total} complete` : 'No tasks yet'}
                      {sum.from && ` · ${fmtDate(sum.from)} – ${fmtDate(sum.to)}`}
                    </span>
                  </button>
                  {canManage && sec.group && (
                    <span className="flex gap-2 text-[11px]">
                      <button onClick={() => setCreating({ parentId: null, groupId: sec.group!.id })} className="text-blue-400 hover:text-blue-300">+ Project task</button>
                      <button onClick={() => groupAction(sec.group!, 'rename')} className="text-slate-400 hover:text-slate-200">Rename</button>
                      <button onClick={() => groupAction(sec.group!, 'up')} aria-label="Move group up" className="text-slate-500 hover:text-slate-200">↑</button>
                      <button onClick={() => groupAction(sec.group!, 'down')} aria-label="Move group down" className="text-slate-500 hover:text-slate-200">↓</button>
                      <button onClick={() => groupAction(sec.group!, 'delete')} className="text-rose-400/80 hover:text-rose-300">Delete</button>
                    </span>
                  )}
                </li>
              )}
              {!shut && flatten(sec.roots, collapsed).map(t => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 hover:bg-slate-800/30" style={{ paddingLeft: `${0.75 + (t.depth + (groups.length ? 1 : 0)) * 1.25}rem` }}>
              <button onClick={() => toggle(t.id)}
                className={`w-4 text-xs text-slate-500 ${t.children.length ? 'hover:text-slate-200' : 'invisible'}`} aria-label={collapsed.has(t.id) ? 'Expand' : 'Collapse'}>
                {collapsed.has(t.id) ? '▸' : '▾'}
              </button>
              {(canManage || allocated(t)) ? (
                <select value={t.status} onChange={e => setStatus(t, e.target.value)} aria-label="Status"
                  className={`rounded border px-1 py-0.5 text-[11px] font-semibold ${TASK_STATUS[t.status].cls} bg-transparent`}>
                  {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k} className="bg-slate-900 text-slate-200">{v.label}</option>)}
                </select>
              ) : <Badge cls={TASK_STATUS[t.status].cls}>{TASK_STATUS[t.status].label}</Badge>}
              <button onClick={() => setOpen(t.id)} className={`min-w-0 flex-1 truncate text-left text-sm ${t.status === 'complete' ? 'text-slate-500 line-through' : 'text-slate-100'} hover:text-blue-300`}>
                {t.name}
                {t.children.length > 0 && <span className="ml-1.5 text-[11px] text-slate-500">({t.children.filter(c => c.status === 'complete').length}/{t.children.length})</span>}
              </button>
              <TaskDocLink base={base} task={t} onOpen={setViewing} compact />
              {t.dependencies?.length > 0 && (() => {
                const problems = depProblems(t, byId);
                return (
                  <span className={`text-[11px] ${problems.length ? 'font-semibold text-rose-400' : 'text-slate-500'}`}
                    title={problems.length ? `Dates clash: ${problems.join('; ')}` : `Starts ${depSummary(t, byId)}`}>
                    {problems.length ? '⚠' : '⛓'} {t.dependencies.length}
                  </span>
                );
              })()}
              <span className="text-[11px] text-slate-400">{t.assignees.map(a => `@${a.handle}`).join(', ') || <span className="text-slate-600">Unallocated</span>}</span>
              {t.due_date && <span className={`text-[11px] ${isOverdue(t) ? 'font-semibold text-rose-400' : 'text-slate-500'}`}>Due {fmtDate(t.due_date)}</span>}
              {t.report_count > 0 && <span className="text-[11px] text-slate-500" title="Status reports">📝 {t.report_count}</span>}
              {canManage && (
                <span className="flex gap-2 text-[11px]">
                  <button onClick={() => setCreating({ parentId: t.id })} className="text-blue-400 hover:text-blue-300">+ Sub-task</button>
                  <button onClick={async () => { await send(`${base}/tasks/${t.id}`, 'PATCH', { move: 'up' }); onChanged(); }} aria-label="Move up" className="text-slate-500 hover:text-slate-200">↑</button>
                  <button onClick={async () => { await send(`${base}/tasks/${t.id}`, 'PATCH', { move: 'down' }); onChanged(); }} aria-label="Move down" className="text-slate-500 hover:text-slate-200">↓</button>
                </span>
              )}
            </li>
              ))}
            </Fragment>
            );
          })}
        </ul>
      )}

      {creating && (
        <Sheet title={creating.parentId ? `New sub-task of “${tasks.find(t => t.id === creating.parentId)?.name}”` : 'New project task'} onClose={() => setCreating(null)}>
          <TaskForm base={base} tasks={tasks} groups={groups} parentId={creating.parentId} groupId={creating.groupId} onDone={() => { setCreating(null); onChanged(); }} />
        </Sheet>
      )}
      {openTask && (
        <TaskSheet base={base} task={openTask} tasks={tasks} groups={groups} me={me} canManage={canManage} onClose={() => setOpen(null)} onChanged={onChanged} onOpenDoc={setViewing} setOpen={setOpen} />
      )}
      {viewing?.document_id && (
        <DocViewer title={viewing.doc_title || viewing.doc_file_name || 'Document'} fileName={viewing.doc_file_name} mime={viewing.doc_mime}
          src={`${societyBaseOf(base)}/documents/${viewing.document_id}/file`} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}

// ── Create / edit a task ─────────────────────────────────────────────────────

function TaskForm({ base, tasks, groups, parentId, groupId, task, onDone }: {
  base: string; tasks: Task[]; groups: TaskGroup[]; parentId?: string | null; groupId?: string | null; task?: Task; onDone: () => void;
}) {
  const topLevel = task ? !task.parent_id : !parentId;
  const NEW = '__new';
  const [group, setGroup] = useState<string>(task?.group_id ?? groupId ?? '');
  const [newGroup, setNewGroup] = useState('');
  const [f, setF] = useState({
    name: task?.name ?? '', description: task?.description ?? '', status: task?.status ?? 'new', comments: task?.comments ?? '',
    startDate: task?.start_date ?? '', endDate: task?.end_date ?? '', dueDate: task?.due_date ?? '',
    documentId: task?.document_id ?? '',
  });
  const [deps, setDeps] = useState<{ taskId: string; kind: DepKind }[]>((task?.dependencies ?? []).map(d => ({ taskId: d.task_id, kind: d.kind })));
  const byId = new Map(tasks.map(t => [t.id, t]));
  // Not itself, its parent tasks or its sub-tasks
  const excluded = family(task?.id ?? '__new', [...tasks, ...(task ? [] : [{ id: '__new', parent_id: parentId ?? null }])]);
  const choices = flatten(buildTree(tasks)).filter(t => !excluded.has(t.id));
  const earliest = earliestStart(deps.filter(d => d.taskId).map(d => ({ task_id: d.taskId, kind: d.kind })), byId);
  const begins = f.startDate || f.endDate || f.dueDate;
  const tooEarly = !!earliest && !!begins && begins < earliest;
  const [docs, setDocs] = useState<DocOption[] | null>(null);
  useEffect(() => {
    fetch(`${societyBaseOf(base)}/documents?all=1`).then(r => r.ok ? r.json() : null)
      .then(d => setDocs(d?.documents ?? [])).catch(() => setDocs([]));
  }, [base]);
  // Grouped by folder for the dropdown
  const folders = new Map<string, DocOption[]>();
  for (const d of docs ?? []) { const k = d.folder || 'Top level'; if (!folders.has(k)) folders.set(k, []); folders.get(k)!.push(d); }
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    const grouping = !topLevel ? {} : group === NEW ? { newGroup: newGroup.trim() } : { groupId: group || null };
    if (group === NEW && !newGroup.trim()) { setSaving(false); setError('Give the new group a name'); return; }
    const body = { ...f, dependencies: deps.filter(d => d.taskId), ...grouping };
    const err = task
      ? await send(`${base}/tasks/${task.id}`, 'PATCH', body)
      : await send(`${base}/tasks`, 'POST', { ...body, parentId });
    setSaving(false);
    if (err) setError(err); else onDone();
  }
  return (
    <form onSubmit={save} className="space-y-3">
      <input value={f.name} onChange={e => setF(v => ({ ...v, name: e.target.value }))} required maxLength={200} placeholder="Project task name" className={inputCls} autoFocus />
      <textarea value={f.description} onChange={e => setF(v => ({ ...v, description: e.target.value }))} rows={3} maxLength={5000} placeholder="Description" className={inputCls} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="text-xs text-slate-400">Start<input type="date" value={f.startDate} onChange={e => setF(v => ({ ...v, startDate: e.target.value }))} className={`${inputCls} mt-1`} /></label>
        <label className="text-xs text-slate-400">End<input type="date" value={f.endDate} min={f.startDate || undefined}
          // New tasks: the due date follows the end date until it's set by hand
          onChange={e => { const end = e.target.value; setF(v => ({ ...v, endDate: end, dueDate: !task && (!v.dueDate || v.dueDate === v.endDate) ? end : v.dueDate })); }}
          className={`${inputCls} mt-1`} /></label>
        <label className="text-xs text-slate-400">Due<input type="date" value={f.dueDate} onChange={e => setF(v => ({ ...v, dueDate: e.target.value }))} className={`${inputCls} mt-1`} /></label>
        <label className="text-xs text-slate-400">Status
          <select value={f.status} onChange={e => setF(v => ({ ...v, status: e.target.value as Task['status'] }))} className={`${inputCls} mt-1`}>
            {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
      </div>
      {topLevel ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-slate-400">Task Group
            <select value={group} onChange={e => setGroup(e.target.value)} className={`${inputCls} mt-1`}>
              <option value="">— No group —</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              <option value={NEW}>+ New group…</option>
            </select>
          </label>
          {group === NEW && (
            <label className="text-xs text-slate-400">New group’s name
              <input value={newGroup} onChange={e => setNewGroup(e.target.value)} maxLength={120} placeholder="e.g. Planning" className={`${inputCls} mt-1`} autoFocus />
            </label>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">Sub-tasks sit in their parent project task’s group.</p>
      )}
      <div className="rounded-lg border border-slate-800 p-2.5">
        <p className="text-xs text-slate-400">Depends on</p>
        {deps.length === 0 && <p className="mt-1 text-[11px] text-slate-600">No dependencies: this project task can start any time.</p>}
        {deps.map((d, i) => (
          <div key={i} className="mt-1.5 flex items-center gap-1.5 text-xs">
            <span className="text-slate-500">Starts after</span>
            <select value={d.taskId} onChange={e => setDeps(ds => ds.map((x, j) => j === i ? { ...x, taskId: e.target.value } : x))}
              className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-slate-200" aria-label="Project task it depends on">
              <option value="">Choose a project task…</option>
              {choices.map(t => (
                <option key={t.id} value={t.id} disabled={deps.some((x, j) => j !== i && x.taskId === t.id)}>
                  {'\u00a0\u00a0'.repeat(t.depth)}{t.name}
                </option>
              ))}
            </select>
            <select value={d.kind} onChange={e => setDeps(ds => ds.map((x, j) => j === i ? { ...x, kind: e.target.value as DepKind } : x))}
              className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-slate-200" aria-label="Finishes or starts">
              {DEP_KINDS.map(k => <option key={k} value={k}>{DEP_LABEL[k]}</option>)}
            </select>
            <button type="button" onClick={() => setDeps(ds => ds.filter((_, j) => j !== i))} aria-label="Remove dependency" className="px-1 text-slate-500 hover:text-rose-400">✕</button>
          </div>
        ))}
        {choices.length > 0 && (
          <button type="button" onClick={() => setDeps(ds => [...ds, { taskId: '', kind: 'finish' }])} className="mt-2 text-xs text-blue-400 hover:text-blue-300">+ Add dependency</button>
        )}
        {earliest && (
          <p className={`mt-2 text-[11px] ${tooEarly ? 'text-rose-400' : 'text-slate-500'}`}>
            {tooEarly ? `Starts too early: its dependencies allow ${fmtDate(earliest)} at the soonest. ` : `Can start from ${fmtDate(earliest)}. `}
            {tooEarly && (
              <button type="button" className="font-semibold text-blue-400 hover:underline" onClick={() => setF(v => {
                // Keep the task's length when moving it
                const len = v.startDate && v.endDate ? (Date.parse(v.endDate) - Date.parse(v.startDate)) / 86400000 : null;
                const end = len != null ? new Date(Date.parse(earliest) + len * 86400000).toISOString().slice(0, 10) : v.endDate && v.endDate < earliest ? earliest : v.endDate;
                return { ...v, startDate: earliest, endDate: end, dueDate: !task && (!v.dueDate || v.dueDate === v.endDate) ? end : v.dueDate };
              })}>Start on {fmtDate(earliest)}</button>
            )}
          </p>
        )}
      </div>
      <label className="block text-xs text-slate-400">Linked document
        <select value={f.documentId} onChange={e => setF(v => ({ ...v, documentId: e.target.value }))} disabled={docs === null} className={`${inputCls} mt-1`}>
          <option value="">{docs === null ? 'Loading documents…' : docs.length ? '— None —' : 'No documents in this Society yet'}</option>
          {[...folders].map(([folder, list]) => (
            <optgroup key={folder} label={folder}>
              {list.map(d => <option key={d.id} value={d.id}>{d.kind === 'link' ? '🔗 ' : d.kind === 'note' ? '📝 ' : '📄 '}{d.title || d.file_name}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      <textarea value={f.comments} onChange={e => setF(v => ({ ...v, comments: e.target.value }))} rows={2} maxLength={5000} placeholder="Comments" className={inputCls} />
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">{saving ? 'Saving…' : task ? 'Save task' : 'Add task'}</button>
    </form>
  );
}

// ── One task: details, allocation, status reports ────────────────────────────

function TaskSheet({ base, task, tasks, groups, me, canManage, onClose, onChanged, onOpenDoc, setOpen }: {
  base: string; task: Task; tasks: Task[]; groups: TaskGroup[]; me: string | null; canManage: boolean; onClose: () => void; onChanged: () => void;
  onOpenDoc: (t: Task) => void; setOpen: (id: string | null) => void;
}) {
  const byId = new Map(tasks.map(t => [t.id, t]));
  const neededBy = tasks.filter(t => t.dependencies?.some(d => d.task_id === task.id));
  const allocated = !!me && task.assignees.some(a => a.id === me);
  const [mode, setMode] = useState<'view' | 'edit' | 'allocate'>('view');
  const [members, setMembers] = useState<Member[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set(task.assignees.map(a => a.id)));
  const [reports, setReports] = useState<(Report & { id: string })[] | null>(null);
  const [report, setReport] = useState({ body: '', status: task.status as string });
  const [comments, setComments] = useState(task.comments ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    // A sealed project's reports are opened here (openFor leaves others unchanged)
    fetch(`${base}/tasks/${task.id}/reports`).then(r => r.ok ? r.json() : null)
      .then(d => setReports((d?.reports ?? []).map((x: Report & { id: string }) => ({ ...x, body: openFor(base, x.body) ?? 'Sealed report' }))))
      .catch(() => setReports([]));
  }, [base, task.id, task.report_count]);

  async function openAllocate() {
    setMode('allocate');
    if (!members.length) {
      const societyBase = base.replace(/\/projects\/[^/]+$/, '');
      const r = await fetch(`${societyBase}/members`);
      if (r.ok) setMembers((await r.json()).members);
    }
  }

  async function saveAllocation() {
    const err = await send(`${base}/tasks/${task.id}/assignees`, 'PUT', { userIds: [...chosen] });
    if (err) setError(err); else { setMode('view'); onChanged(); }
  }

  async function fileReport(e: React.FormEvent) {
    e.preventDefault();
    const err = await send(`${base}/tasks/${task.id}/reports`, 'POST', report);
    if (err) setError(err); else { setReport({ body: '', status: report.status }); onChanged(); }
  }

  async function remove() {
    if (!confirm(`Delete “${task.name}”${task.report_count ? ' and its status reports' : ''}? Its sub-tasks are deleted too.`)) return;
    const err = await send(`${base}/tasks/${task.id}`, 'DELETE');
    if (err) setError(err); else { onClose(); onChanged(); }
  }

  return (
    <Sheet title={task.name} onClose={onClose}>
      <div className="mb-2 flex justify-end">
        <ReportButton kind="project_task" id={task.id} what="this project task"
          shown={() => [task.name, task.description].filter(Boolean).join('\n')} />
      </div>
      {error && <p className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
      {mode === 'edit' ? (
        <TaskForm base={base} tasks={tasks} groups={groups} task={task} onDone={() => { setMode('view'); onChanged(); }} />
      ) : mode === 'allocate' ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">Choose the members working on this project task.</p>
          <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
            {members.map(m => (
              <li key={m.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-800/50">
                  <input type="checkbox" checked={chosen.has(m.id)} className="accent-blue-500"
                    onChange={() => setChosen(s => { const n = new Set(s); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })} />
                  <span className="text-sm text-slate-200">{m.name ? `${m.name} ` : ''}<span className="text-slate-500">@{m.handle}</span></span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button onClick={saveAllocation} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">Save allocation</button>
            <button onClick={() => setMode('view')} className="px-2 text-sm text-slate-500 hover:text-slate-300">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge cls={TASK_STATUS[task.status].cls}>{TASK_STATUS[task.status].label}</Badge>
            {task.start_date && <span className="text-slate-400">Start {fmtDate(task.start_date)}</span>}
            {task.end_date && <span className="text-slate-400">· End {fmtDate(task.end_date)}</span>}
            {task.due_date && <span className={isOverdue(task) ? 'font-semibold text-rose-400' : 'text-slate-400'}>· Due {fmtDate(task.due_date)}{isOverdue(task) ? ' (overdue)' : ''}</span>}
            {task.group_id && groups.find(g => g.id === task.group_id) && <span className="text-slate-400">· Group: <span className="text-slate-200">{groups.find(g => g.id === task.group_id)!.name}</span></span>}
          </div>
          {(task.dependencies?.length > 0 || neededBy.length > 0) && (
            <div className="space-y-1 text-sm">
              {task.dependencies?.length > 0 && (
                <p><span className="text-slate-500">Starts after: </span>
                  {task.dependencies.map((d, i) => {
                    const other = byId.get(d.task_id);
                    const problem = other ? depProblem(task, other, d.kind) : null;
                    return (
                      <span key={d.task_id}>{i > 0 && ', '}
                        <button onClick={() => setOpen(d.task_id)} className={`hover:underline ${problem ? 'text-rose-400' : 'text-blue-300'}`} title={problem ?? undefined}>
                          {other?.name ?? 'a deleted task'}
                        </button> <span className="text-slate-400">{DEP_LABEL[d.kind]}</span>{problem && <span className="text-rose-400"> ⚠</span>}
                      </span>
                    );
                  })}
                </p>
              )}
              {depProblems(task, byId).length > 0 && (
                <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  The dates clash: this task {depProblems(task, byId).join('; ')}.{canManage ? ' Edit the task to move it.' : ''}
                </p>
              )}
              {neededBy.length > 0 && (
                <p><span className="text-slate-500">Needed before: </span>
                  {neededBy.map((t, i) => (
                    <span key={t.id}>{i > 0 && ', '}
                      <button onClick={() => setOpen(t.id)} className="text-blue-300 hover:underline">{t.name}</button>
                    </span>
                  ))}
                </p>
              )}
            </div>
          )}
          {task.description && <RichText text={task.description} />}
          {task.document_id && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Document:</span>
              <TaskDocLink base={base} task={task} onOpen={onOpenDoc} />
            </div>
          )}
          <div className="text-sm">
            <span className="text-slate-500">Allocated to: </span>
            <span className="text-slate-200">{task.assignees.length ? task.assignees.map(a => a.name ? `${a.name} (@${a.handle})` : `@${a.handle}`).join(', ') : 'nobody yet'}</span>
            {canManage && <button onClick={openAllocate} className="ml-2 text-xs text-blue-400 hover:underline">Change</button>}
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Comments</p>
            {(canManage || allocated) ? (
              <div className="space-y-2">
                <textarea value={comments} onChange={e => setComments(e.target.value)} rows={2} maxLength={5000} className={inputCls} placeholder="Notes on this project task" />
                {comments !== (task.comments ?? '') && (
                  <button onClick={async () => { const err = await send(`${base}/tasks/${task.id}`, 'PATCH', { comments }); if (err) setError(err); else onChanged(); }}
                    className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500">Save comments</button>
                )}
              </div>
            ) : task.comments ? <RichText text={task.comments} /> : <p className="text-xs text-slate-600">None</p>}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Status reports</p>
            {(allocated || canManage) && (
              <form onSubmit={fileReport} className="mb-3 space-y-2 rounded-xl border border-slate-800 p-3">
                <textarea value={report.body} onChange={e => setReport(r => ({ ...r, body: e.target.value }))} rows={3} maxLength={5000} required
                  placeholder="Progress since the last report, what's next, anything blocking" className={inputCls} />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs text-slate-400">Project task status now
                    <select value={report.status} onChange={e => setReport(r => ({ ...r, status: e.target.value }))} className="ml-2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200">
                      {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </label>
                  <button type="submit" disabled={!report.body.trim()} className="ml-auto rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50">File report</button>
                </div>
              </form>
            )}
            {reports === null ? <p className="text-xs text-slate-600">Loading…</p> : reports.length === 0 ? (
              <p className="text-xs text-slate-600">No status reports yet.</p>
            ) : (
              <ol className="space-y-2">
                {reports.map(r => (
                  <li key={r.id} className="rounded-lg border border-slate-800 px-3 py-2">
                    <p className="text-[11px] text-slate-500">
                      @{r.by ?? 'unknown'} · {new Date(r.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {' · '}<span className="text-slate-400">{TASK_STATUS[r.status]?.label}</span>
                    </p>
                    <div className="mt-1"><RichText text={r.body} /></div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {canManage && (
            <div className="flex gap-3 border-t border-slate-800 pt-3 text-sm">
              <button onClick={() => setMode('edit')} className="text-slate-300 hover:text-white">Edit project task</button>
              <button onClick={remove} className="text-rose-400 hover:text-rose-300">Delete project task</button>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
