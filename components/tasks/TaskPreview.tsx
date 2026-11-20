'use client';

import { useState } from 'react';
import RefHtml from '@/components/refs/RefHtml';
import RichText from '@/components/discussions/RichText';
import { Chip, fmtDay, Modal, overdue, send, TASK_STATUS, taskNo, type ProjectTask, type QuickTask, type Swatch } from './shared';

// A read-only look at a task (yours, or one shared with you), or at a Project
// Task (with a link to it in its project). On a Project Task you can set your
// own categories. A click outside or Escape closes it. showOpen (e.g. from the
// Calendar): also a button to open a task in Tasks.
export default function TaskPreview({ society, item, priorities, categories, onClose, onChanged, showOpen = false }: {
  society: number; item: { kind: 'task'; t: QuickTask } | { kind: 'project'; t: ProjectTask };
  priorities: Swatch[]; categories: Swatch[]; onClose: () => void; onChanged: () => void; showOpen?: boolean;
}) {
  const t = item.t;
  const [cats, setCats] = useState<string[]>(t.categories);
  const [error, setError] = useState('');
  const st = TASK_STATUS[t.status];
  const prio = item.kind === 'task' ? priorities.find(p => p.id === item.t.priority_id) : null;
  const label = 'mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500';

  async function toggle(id: string) {
    const next = cats.includes(id) ? cats.filter(x => x !== id) : [...cats, id];
    setCats(next); setError('');
    const r = await send(`/api/societies/${society}/tasks/project-tasks/${t.id}`, 'PUT', { categoryIds: next });
    if (!r.ok) { setError(String(r.data.error ?? 'Couldn’t save')); setCats(cats); return; }
    onChanged();
  }

  return (
    <Modal onClose={onClose} wide label={`Preview: ${t.name}`}>
      <div className="space-y-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-500">
              {item.kind === 'task'
                ? (item.t.mine ? <>{taskNo(item.t.number)} · Your task</> : <>{taskNo(item.t.number)} · Task by @{item.t.owner} · shared with you · read-only</>)
                : <>Project Task · {item.t.project}{item.t.assignees.length ? ` · ${item.t.assignees.map(a => '@' + a.handle).join(', ')}` : ''}</>}
            </p>
            <h3 className="text-base font-semibold text-slate-100">{item.kind === 'project' && item.t.locked && '🔐 '}{t.name}</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-700/50 hover:text-white">×</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {st && <span className={`rounded-full border px-2 py-px ${st.cls}`}>{st.label}</span>}
          {prio && <Chip s={prio} />}
          {t.due_date && <span className={overdue(t.due_date, t.status) ? 'text-rose-400' : 'text-slate-300'}>Due {fmtDay(t.due_date)}</span>}
        </div>

        {item.kind === 'task' ? (
          <>
            <div><p className={label}>Description</p>{item.t.description ? <RefHtml html={item.t.description} /> : <p className="text-sm italic text-slate-500">None</p>}</div>
            {item.t.notes && <div><p className={label}>Notes</p><RefHtml html={item.t.notes} /></div>}
          </>
        ) : item.t.locked ? (
          <p className="text-sm text-slate-400">This project is sealed. Open it in its project to read it with your secure access.</p>
        ) : (
          <>
            <div><p className={label}>Description</p>{item.t.description ? <RichText text={item.t.description} /> : <p className="text-sm italic text-slate-500">None</p>}</div>
            {item.t.comments && <div><p className={label}>Comments</p><RichText text={item.t.comments} /></div>}
          </>
        )}

        {item.kind === 'project' && (
          <div>
            <p className={label}>Your categories <span className="normal-case tracking-normal font-normal text-slate-600">(only you see them)</span></p>
            {categories.length ? (
              <div className="flex flex-wrap gap-1.5">
                {categories.map(c => (
                  <button key={c.id} type="button" onClick={() => toggle(c.id)} aria-pressed={cats.includes(c.id)}><Chip s={c} dim={!cats.includes(c.id)} /></button>
                ))}
              </div>
            ) : <p className="text-xs text-slate-500">No categories yet.</p>}
            {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
          </div>
        )}

        {(item.kind === 'project' || showOpen) && (
          <div className="flex justify-end border-t border-slate-700/60 pt-3">
            {item.kind === 'project'
              ? <a href={`/society/${society}/projects/${item.t.project_id}?task=${item.t.id}`} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500">Open in project →</a>
              : <a href={`/society/${society}/tasks?task=${item.t.id}`} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500">{item.t.mine ? 'Open in Tasks to edit →' : 'Open in Tasks →'}</a>}
          </div>
        )}
      </div>
    </Modal>
  );
}
