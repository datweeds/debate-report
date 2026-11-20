'use client';

import { useState } from 'react';
import { inputCls, Modal, send, taskNo, type ConvertTarget, type QuickTask } from './shared';

// Turn one of your tasks into a Project Task, in a project you manage (or any, for moderators).
export default function ConvertDialog({ society, task, targets, onDone, onClose }: {
  society: number; task: QuickTask; targets: ConvertTarget[]; onDone: (projectId: string) => void; onClose: () => void;
}) {
  const [projectId, setProjectId] = useState(targets[0]?.id ?? '');
  const [group, setGroup] = useState('');            // '' none, '+' new, or a group id
  const [newGroup, setNewGroup] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const project = targets.find(p => p.id === projectId);
  const privateTask = !task.shared_all && !task.shares?.length;

  async function convert() {
    if (!projectId) return;
    if (group === '+' && !newGroup.trim()) { setError('Name the new group'); return; }
    setBusy(true); setError('');
    const r = await send(`/api/societies/${society}/tasks/${task.id}/convert`, 'POST', {
      projectId, ...(group === '+' ? { newGroup } : group ? { groupId: group } : {}),
    });
    setBusy(false);
    if (!r.ok) { setError(String(r.data.error ?? 'Couldn’t convert it')); return; }
    onDone(projectId);
  }

  return (
    <Modal onClose={onClose} keepOpen label="Convert to project task">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-100">Convert to a project task</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-700/50 hover:text-white">×</button>
        </div>
        <p className="text-sm text-slate-300"><span className="font-mono text-slate-500">{taskNo(task.number)}</span> {task.name}</p>
        {!targets.length ? (
          <p className="text-sm text-slate-400">There’s no project you can add tasks to yet. You can add tasks to projects you manage (or any project, as a moderator), but not to sealed or completed ones. <a href={`/society/${society}/projects`} className="font-semibold text-blue-300 hover:underline">Go to Projects</a> to start one, then come back to convert this task.</p>
        ) : (
          <>
            <label className="block text-xs text-slate-400">Project
              <select value={projectId} onChange={e => { setProjectId(e.target.value); setGroup(''); }} className={`${inputCls} mt-1`}>
                {targets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></label>
            <label className="block text-xs text-slate-400">Task group <span className="text-slate-600">(optional)</span>
              <select value={group} onChange={e => setGroup(e.target.value)} className={`${inputCls} mt-1`}>
                <option value="">No group</option>
                {project?.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                <option value="+">New group…</option>
              </select></label>
            {group === '+' && <input value={newGroup} onChange={e => setNewGroup(e.target.value)} maxLength={120} placeholder="Group name" className={inputCls} />}
            <ul className="list-disc space-y-1 pl-5 text-xs text-slate-400">
              <li>Its title, description, status, due date and your categories go with it; your notes become its comments (as plain text).</li>
              <li>It moves out of Tasks into the project, and you’re assigned to it. It still shows in your Tasks list as a Project Task.</li>
              {privateTask && <li className="text-amber-300">It’s private now: in the project, everyone who can see the project can see it.</li>}
            </ul>
          </>
        )}
        {error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
        <div className="flex gap-2">
          {targets.length > 0 && (
            <button onClick={convert} disabled={busy} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50">
              {busy ? 'Converting…' : 'Convert'}
            </button>
          )}
          <button onClick={onClose} className="px-2 text-sm text-slate-500 hover:text-slate-300">Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
