'use client';

import { useEffect, useState } from 'react';
import TaskPreview from '@/components/tasks/TaskPreview';
import { Modal, type TasksData } from '@/components/tasks/shared';

// A task or project task clicked on the calendar: a read-only preview, with a
// button to open it in Tasks or in its project. Uses the Tasks list data (it
// carries the priorities and your categories the preview shows).
export default function CalendarTaskPreview({ society, kind, id, onClose }: {
  society: number; kind: 'task' | 'project'; id: string; onClose: () => void;
}) {
  const [data, setData] = useState<TasksData | null>(null);
  const [error, setError] = useState('');
  const load = () => fetch(`/api/societies/${society}/tasks`)
    .then(async r => { if (r.ok) setData(await r.json()); else setError('This task couldn’t be loaded.'); })
    .catch(() => setError('This task couldn’t be loaded.'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [society]);

  const t = kind === 'task' ? data?.tasks.find(x => x.id === id) : data?.projectTasks.find(x => x.id === id);
  if (data && t) {
    const item = kind === 'task'
      ? { kind: 'task' as const, t: data.tasks.find(x => x.id === id)! }
      // A sealed project's text can't be read here: the preview says so
      : { kind: 'project' as const, t: (p => ({ ...p, locked: p.locked || p.name.startsWith('sn1:') || p.name.startsWith('🔐') }))(data.projectTasks.find(x => x.id === id)!) };
    return <TaskPreview society={society} item={item} priorities={data.priorities} categories={data.categories}
      onClose={onClose} onChanged={() => void load()} showOpen />;
  }
  return (
    <Modal onClose={onClose} label="Task preview">
      <div className="flex items-center justify-between gap-3">
        {error || (data && !t)
          ? <p className="text-sm text-slate-400">{error || 'This task has been deleted, or you no longer have access to it.'}</p>
          : <div className="h-16 flex-1 animate-pulse rounded-xl bg-slate-800/40" />}
        <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-700/50 hover:text-white">×</button>
      </div>
    </Modal>
  );
}
