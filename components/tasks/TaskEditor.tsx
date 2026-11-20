'use client';

import { useEffect, useMemo, useState } from 'react';
import { Chip, inputCls, Modal, RichField, send, TASK_STATUS, taskNo, type Person, type QuickTask, type Swatch } from './shared';

type Sharing = 'me' | 'all' | 'some';

// Add or edit one of your own tasks. Stays open on a click outside; Cancel,
// × or Escape ask before throwing away changes.
export default function TaskEditor({ society, me, task, priorities, categories, canConvert, onSaved, onClose, onConvert }: {
  society: number; me: string; task: QuickTask | null; priorities: Swatch[]; categories: Swatch[]; canConvert: boolean;
  onSaved: () => void; onClose: () => void; onConvert: (t: QuickTask) => void;
}) {
  const base = `/api/societies/${society}/tasks`;
  const start = useMemo(() => ({
    name: task?.name ?? '', status: task?.status ?? 'new', priorityId: task?.priority_id ?? '', dueDate: task?.due_date ?? '',
    description: task?.description ?? '', notes: task?.notes ?? '', categoryIds: task?.categories ?? [],
    sharing: (task?.shared_all ? 'all' : task?.shares?.length ? 'some' : 'me') as Sharing,
    shareWith: (task?.shares ?? []).map(s => s.id),
  }), [task]);
  const [f, setF] = useState(start);
  const [members, setMembers] = useState<(Person & { name?: string | null })[] | null>(null);
  const [memberQ, setMemberQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(p => ({ ...p, [k]: v }));
  const dirty = JSON.stringify(f) !== JSON.stringify(start);

  useEffect(() => {
    if (f.sharing !== 'some' || members) return;
    fetch(`/api/societies/${society}/members`).then(r => r.ok ? r.json() : { members: [] }).then(d => setMembers(d.members)).catch(() => setMembers([]));
  }, [f.sharing, members, society]);

  function cancel() {
    if (dirty && !confirm('Discard the changes to this task?')) return;
    onClose();
  }
  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!f.name.trim()) { setError('Give the task a title'); return; }
    if (f.sharing === 'some' && !f.shareWith.length) { setError('Choose who to share it with, or choose “Only me”'); return; }
    setSaving(true); setError('');
    const body = {
      name: f.name, status: f.status, priorityId: f.priorityId || null, dueDate: f.dueDate || null,
      description: f.description || null, notes: f.notes || null, categoryIds: f.categoryIds,
      sharedAll: f.sharing === 'all', shareWith: f.sharing === 'some' ? f.shareWith : [],
    };
    const r = task ? await send(`${base}/${task.id}`, 'PATCH', body) : await send(base, 'POST', body);
    setSaving(false);
    if (!r.ok) { setError(String(r.data.error ?? 'Couldn’t save the task')); return; }
    onSaved();
  }
  async function remove() {
    if (!task || !confirm(`Delete ${taskNo(task.number)} “${task.name}”?`)) return;
    const r = await send(`${base}/${task.id}`, 'DELETE');
    if (!r.ok) { setError(String(r.data.error ?? 'Couldn’t delete it')); return; }
    onSaved();
  }

  const toggleCat = (id: string) => set('categoryIds', f.categoryIds.includes(id) ? f.categoryIds.filter(x => x !== id) : [...f.categoryIds, id]);
  const toggleMember = (id: string) => set('shareWith', f.shareWith.includes(id) ? f.shareWith.filter(x => x !== id) : [...f.shareWith, id]);
  const shownMembers = (members ?? []).filter(m => !memberQ || `${m.handle} ${m.name ?? ''}`.toLowerCase().includes(memberQ.toLowerCase()));
  const label = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500';

  return (
    <Modal onClose={cancel} keepOpen wide label={task ? `Edit ${taskNo(task.number)}` : 'New task'}>
      <form onSubmit={save} className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-100">{task ? <><span className="mr-2 font-mono text-sm text-slate-500">{taskNo(task.number)}</span>Edit task</> : 'New task'}</h3>
          <button type="button" onClick={cancel} aria-label="Close" className="rounded-lg px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-700/50 hover:text-white">×</button>
        </div>
        <input value={f.name} onChange={e => set('name', e.target.value)} maxLength={300} placeholder="Title" aria-label="Title" className={inputCls} autoFocus={!task} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="text-xs"><span className={label}>Status</span>
            <select value={f.status} onChange={e => set('status', e.target.value)} className={inputCls}>
              {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select></label>
          <label className="text-xs"><span className={label}>Priority</span>
            <select value={f.priorityId} onChange={e => set('priorityId', e.target.value)} className={inputCls}>
              <option value="">None</option>
              {priorities.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></label>
          <label className="text-xs"><span className={label}>Due</span>
            <input type="date" value={f.dueDate} onChange={e => set('dueDate', e.target.value)} className={inputCls} /></label>
        </div>

        <div>
          <span className={label}>Categories <span className="normal-case tracking-normal font-normal text-slate-600">(yours: only you see them)</span></span>
          {categories.length ? (
            <div className="flex flex-wrap gap-1.5">
              {categories.map(c => (
                <button key={c.id} type="button" onClick={() => toggleCat(c.id)} aria-pressed={f.categoryIds.includes(c.id)}>
                  <Chip s={c} dim={!f.categoryIds.includes(c.id)} />
                </button>
              ))}
            </div>
          ) : <p className="text-xs text-slate-500">No categories yet: add some with “Categories” on the Tasks page.</p>}
        </div>

        <div><span className={label}>Description</span>
          <RichField society={society} value={start.description} onChange={v => set('description', v)} label="Description" /></div>
        <div><span className={label}>Notes</span>
          <RichField society={society} value={start.notes} onChange={v => set('notes', v)} label="Notes" /></div>

        <fieldset>
          <legend className={label}>Who can see it</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-200">
            {([['me', 'Only me'], ['all', 'Everyone in the Society'], ['some', 'Chosen members']] as const).map(([v, l]) => (
              <label key={v} className="flex items-center gap-1.5"><input type="radio" checked={f.sharing === v} onChange={() => set('sharing', v)} className="accent-blue-500" />{l}</label>
            ))}
          </div>
          {f.sharing !== 'me' && <p className="mt-1 text-[11px] text-slate-500">They can read it but not change it. Your categories stay private.</p>}
          {f.sharing === 'some' && (
            <div className="mt-2 rounded-lg border border-slate-800 p-2">
              <input value={memberQ} onChange={e => setMemberQ(e.target.value)} placeholder="Find a member…" className={`${inputCls} py-1.5 text-xs`} />
              <div className="mt-2 max-h-36 space-y-0.5 overflow-y-auto">
                {!members ? <p className="text-xs text-slate-500">Loading…</p>
                  : shownMembers.filter(m => m.id !== me).map(m => (
                    <label key={m.id} className="flex items-center gap-2 rounded px-1 py-0.5 text-xs text-slate-200 hover:bg-slate-800/60">
                      <input type="checkbox" checked={f.shareWith.includes(m.id)} onChange={() => toggleMember(m.id)} className="accent-blue-500" />
                      @{m.handle}{m.name ? <span className="text-slate-500">{m.name}</span> : null}
                    </label>
                  ))}
              </div>
            </div>
          )}
        </fieldset>

        {error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
            {saving ? 'Saving…' : task ? 'Save' : 'Add task'}
          </button>
          <button type="button" onClick={cancel} className="px-2 text-sm text-slate-500 hover:text-slate-300">Cancel</button>
          <span className="flex-1" />
          {task && canConvert && (
            <button type="button" onClick={() => { if (!dirty || confirm('Convert without saving your changes?')) onConvert(task); }}
              className="rounded-lg border border-violet-500/50 px-3 py-1.5 text-xs text-violet-300 hover:bg-violet-500/10">Convert to project task…</button>
          )}
          {task && <button type="button" onClick={remove} className="px-2 text-xs text-rose-400 hover:text-rose-300">Delete</button>}
        </div>
      </form>
    </Modal>
  );
}
