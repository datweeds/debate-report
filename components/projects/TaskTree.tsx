'use client';

import { useEffect, useState } from 'react';
import RichText from '@/components/discussions/RichText';
import { Badge, fmtDate, inputCls, send, Sheet, TASK_STATUS, todayKey, type Member } from './shared';

export type Report = { body: string; status: string; created_at: string; by: string | null };
export type Task = {
  id: string; parent_id: string | null; sort_order: number; name: string; description: string | null;
  status: 'new' | 'in_progress' | 'complete'; comments: string | null;
  start_date: string | null; end_date: string | null; due_date: string | null;
  assignees: { id: string; handle: string; name: string | null }[];
  latest_report: Report | null; report_count: number;
};

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

export default function TaskTree({ base, tasks, me, canManage, onChanged, open, setOpen }: {
  base: string; tasks: Task[]; me: string | null; canManage: boolean; onChanged: () => void;
  open: string | null; setOpen: (id: string | null) => void;   // the task whose sheet is showing
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState<{ parentId: string | null } | null>(null);
  const [error, setError] = useState('');
  const rows = flatten(buildTree(tasks), collapsed);
  const openTask = tasks.find(t => t.id === open) ?? null;

  const allocated = (t: Task) => !!me && t.assignees.some(a => a.id === me);

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
        {canManage && <button onClick={() => setCreating({ parentId: null })} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500">+ Add task</button>}
      </div>
      {error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-10 text-center text-sm text-slate-500">No tasks yet.</div>
      ) : (
        <ul className="divide-y divide-slate-800/60 overflow-hidden rounded-2xl border border-slate-800 bg-[#0c1322]">
          {rows.map(t => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 hover:bg-slate-800/30" style={{ paddingLeft: `${0.75 + t.depth * 1.25}rem` }}>
              <button onClick={() => setCollapsed(s => { const n = new Set(s); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })}
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
        </ul>
      )}

      {creating && (
        <Sheet title={creating.parentId ? `New sub-task of “${tasks.find(t => t.id === creating.parentId)?.name}”` : 'New task'} onClose={() => setCreating(null)}>
          <TaskForm base={base} parentId={creating.parentId} onDone={() => { setCreating(null); onChanged(); }} />
        </Sheet>
      )}
      {openTask && (
        <TaskSheet base={base} task={openTask} me={me} canManage={canManage} onClose={() => setOpen(null)} onChanged={onChanged} />
      )}
    </div>
  );
}

// ── Create / edit a task ─────────────────────────────────────────────────────

function TaskForm({ base, parentId, task, onDone }: { base: string; parentId?: string | null; task?: Task; onDone: () => void }) {
  const [f, setF] = useState({
    name: task?.name ?? '', description: task?.description ?? '', status: task?.status ?? 'new', comments: task?.comments ?? '',
    startDate: task?.start_date ?? '', endDate: task?.end_date ?? '', dueDate: task?.due_date ?? '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    const err = task
      ? await send(`${base}/tasks/${task.id}`, 'PATCH', f)
      : await send(`${base}/tasks`, 'POST', { ...f, parentId });
    setSaving(false);
    if (err) setError(err); else onDone();
  }
  return (
    <form onSubmit={save} className="space-y-3">
      <input value={f.name} onChange={e => setF(v => ({ ...v, name: e.target.value }))} required maxLength={200} placeholder="Task name" className={inputCls} autoFocus />
      <textarea value={f.description} onChange={e => setF(v => ({ ...v, description: e.target.value }))} rows={3} maxLength={5000} placeholder="Description" className={inputCls} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="text-xs text-slate-400">Start<input type="date" value={f.startDate} onChange={e => setF(v => ({ ...v, startDate: e.target.value }))} className={`${inputCls} mt-1`} /></label>
        <label className="text-xs text-slate-400">End<input type="date" value={f.endDate} min={f.startDate || undefined} onChange={e => setF(v => ({ ...v, endDate: e.target.value }))} className={`${inputCls} mt-1`} /></label>
        <label className="text-xs text-slate-400">Due<input type="date" value={f.dueDate} onChange={e => setF(v => ({ ...v, dueDate: e.target.value }))} className={`${inputCls} mt-1`} /></label>
        <label className="text-xs text-slate-400">Status
          <select value={f.status} onChange={e => setF(v => ({ ...v, status: e.target.value as Task['status'] }))} className={`${inputCls} mt-1`}>
            {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
      </div>
      <textarea value={f.comments} onChange={e => setF(v => ({ ...v, comments: e.target.value }))} rows={2} maxLength={5000} placeholder="Comments" className={inputCls} />
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">{saving ? 'Saving…' : task ? 'Save task' : 'Add task'}</button>
    </form>
  );
}

// ── One task: details, allocation, status reports ────────────────────────────

function TaskSheet({ base, task, me, canManage, onClose, onChanged }: {
  base: string; task: Task; me: string | null; canManage: boolean; onClose: () => void; onChanged: () => void;
}) {
  const allocated = !!me && task.assignees.some(a => a.id === me);
  const [mode, setMode] = useState<'view' | 'edit' | 'allocate'>('view');
  const [members, setMembers] = useState<Member[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set(task.assignees.map(a => a.id)));
  const [reports, setReports] = useState<(Report & { id: string })[] | null>(null);
  const [report, setReport] = useState({ body: '', status: task.status as string });
  const [comments, setComments] = useState(task.comments ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${base}/tasks/${task.id}/reports`).then(r => r.ok ? r.json() : null).then(d => setReports(d?.reports ?? [])).catch(() => setReports([]));
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
      {error && <p className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
      {mode === 'edit' ? (
        <TaskForm base={base} task={task} onDone={() => { setMode('view'); onChanged(); }} />
      ) : mode === 'allocate' ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">Choose the members working on this task.</p>
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
          </div>
          {task.description && <RichText text={task.description} />}
          <div className="text-sm">
            <span className="text-slate-500">Allocated to: </span>
            <span className="text-slate-200">{task.assignees.length ? task.assignees.map(a => a.name ? `${a.name} (@${a.handle})` : `@${a.handle}`).join(', ') : 'nobody yet'}</span>
            {canManage && <button onClick={openAllocate} className="ml-2 text-xs text-blue-400 hover:underline">Change</button>}
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Comments</p>
            {(canManage || allocated) ? (
              <div className="space-y-2">
                <textarea value={comments} onChange={e => setComments(e.target.value)} rows={2} maxLength={5000} className={inputCls} placeholder="Notes on this task" />
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
                  <label className="text-xs text-slate-400">Task status now
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
              <button onClick={() => setMode('edit')} className="text-slate-300 hover:text-white">Edit task</button>
              <button onClick={remove} className="text-rose-400 hover:text-rose-300">Delete task</button>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
