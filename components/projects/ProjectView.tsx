'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import RichText from '@/components/discussions/RichText';
import TaskTree, { type Task } from './TaskTree';
import Gantt from './Gantt';
import { RaidList, StatusReport, type Raid } from './Report';
import { Badge, fmtDate, inputCls, PROJECT_STATUS, send, Sheet, type Member } from './shared';

type Project = {
  id: string; name: string; description: string | null; status: string; manager_id: string | null;
  start_date: string | null; end_date: string | null;
  manager: { id: string; user_handle: string; user_full_name: string | null } | null;
};
type Data = {
  project: Project; tasks: Task[]; raid: Raid[]; me: string | null;
  canManage: boolean; canModerate: boolean; canContribute: boolean; isManager: boolean;
};
const TABS = [{ id: 'tasks', label: 'Tasks' }, { id: 'gantt', label: 'Gantt' }, { id: 'report', label: 'Status report & RAID' }] as const;

export default function ProjectView({ societyId, projectId }: { societyId: number; projectId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const tab = (params.get('tab') ?? 'tasks') as typeof TABS[number]['id'];
  const base = `/api/societies/${societyId}/projects/${projectId}`;
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(base);
    if (!r.ok) { setError(r.status === 404 ? 'This project no longer exists.' : 'Could not load the project.'); return; }
    setData(await r.json());
  }, [base]);
  useEffect(() => { load(); }, [load]);

  const go = (t: string) => router.replace(`/society/${societyId}/projects/${projectId}${t === 'tasks' ? '' : `?tab=${t}`}`);
  // Opening a task from the Gantt chart or report shows its sheet on the Tasks tab
  const openFromElsewhere = (id: string) => { go('tasks'); setOpenTask(id); };

  if (!data) return error ? <p className="text-sm text-rose-400">{error}</p> : <div className="h-40 rounded-2xl bg-slate-800/40 animate-pulse" />;
  const p = data.project;

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/society/${societyId}/projects`} className="text-xs text-slate-500 hover:text-slate-300">← Projects</Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold text-slate-100">{p.name}</h2>
          <Badge cls={PROJECT_STATUS[p.status]?.cls ?? ''}>{PROJECT_STATUS[p.status]?.label ?? p.status}</Badge>
          <span className="flex-1" />
          {data.canManage && <button onClick={() => setSettings(true)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500">Project settings</button>}
          {tab === 'report' && <button onClick={() => window.print()} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500">Print</button>}
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Project Manager: {p.manager ? <span className="text-slate-200">{p.manager.user_full_name ?? `@${p.manager.user_handle}`}</span> : <span className="text-amber-300">not yet chosen</span>}
          {data.isManager && <span className="text-emerald-300"> (you)</span>}
          {(p.start_date || p.end_date) && <> · {fmtDate(p.start_date) || '…'} – {fmtDate(p.end_date) || '…'}</>}
        </p>
        {p.description && <div className="mt-2 max-w-3xl"><RichText text={p.description} /></div>}
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-slate-800 print:hidden">
        {TABS.map(t => (
          <button key={t.id} onClick={() => go(t.id)}
            className={`whitespace-nowrap border-b-2 -mb-px px-3 py-2 text-sm font-medium ${tab === t.id ? 'border-blue-500 text-blue-300' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'tasks' && (
        <TaskTree base={base} tasks={data.tasks} me={data.me} canManage={data.canManage} onChanged={load} open={openTask} setOpen={setOpenTask} />
      )}
      {tab === 'gantt' && <Gantt tasks={data.tasks} projectStart={p.start_date} projectEnd={p.end_date} onOpen={openFromElsewhere} />}
      {tab === 'report' && (
        <div className="space-y-8">
          <StatusReport base={base} tasks={data.tasks} onOpen={openFromElsewhere} />
          <RaidList base={base} raid={data.raid} me={data.me} canManage={data.canManage} canContribute={data.canContribute} onChanged={load} />
        </div>
      )}

      {settings && (
        <ProjectSettings societyId={societyId} base={base} project={p} canModerate={data.canModerate}
          onClose={() => setSettings(false)} onSaved={() => { setSettings(false); load(); }}
          onDeleted={() => router.push(`/society/${societyId}/projects`)} />
      )}
    </div>
  );
}

function ProjectSettings({ societyId, base, project, canModerate, onClose, onSaved, onDeleted }: {
  societyId: number; base: string; project: Project; canModerate: boolean; onClose: () => void; onSaved: () => void; onDeleted: () => void;
}) {
  const [f, setF] = useState({
    name: project.name, description: project.description ?? '', status: project.status,
    managerId: project.manager_id ?? '', startDate: project.start_date ?? '', endDate: project.end_date ?? '',
  });
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!canModerate) return;
    fetch(`/api/societies/${societyId}/members`).then(r => r.ok ? r.json() : null).then(d => setMembers(d?.members ?? [])).catch(() => {});
  }, [societyId, canModerate]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = canModerate ? { ...f, managerId: f.managerId || null }
      : { description: f.description, status: f.status, startDate: f.startDate, endDate: f.endDate };
    const err = await send(base, 'PATCH', body);
    if (err) setError(err); else onSaved();
  }

  return (
    <Sheet title="Project settings" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        {canModerate && <input value={f.name} onChange={e => setF(v => ({ ...v, name: e.target.value }))} required maxLength={200} className={inputCls} />}
        <textarea value={f.description} onChange={e => setF(v => ({ ...v, description: e.target.value }))} rows={3} maxLength={5000} placeholder="Description" className={inputCls} />
        <div className="grid gap-2 sm:grid-cols-2">
          {canModerate && (
            <label className="text-xs text-slate-400">Project Manager
              <select value={f.managerId} onChange={e => setF(v => ({ ...v, managerId: e.target.value }))} className={`${inputCls} mt-1`}>
                <option value="">None</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name ? `${m.name} (@${m.handle})` : `@${m.handle}`}</option>)}
              </select>
            </label>
          )}
          <label className="text-xs text-slate-400">Status
            <select value={f.status} onChange={e => setF(v => ({ ...v, status: e.target.value }))} className={`${inputCls} mt-1`}>
              {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">Starts<input type="date" value={f.startDate} onChange={e => setF(v => ({ ...v, startDate: e.target.value }))} className={`${inputCls} mt-1`} /></label>
          <label className="text-xs text-slate-400">Ends<input type="date" value={f.endDate} min={f.startDate || undefined} onChange={e => setF(v => ({ ...v, endDate: e.target.value }))} className={`${inputCls} mt-1`} /></label>
        </div>
        {!canModerate && <p className="text-[11px] text-slate-500">Only a moderator can rename the project or change its Project Manager.</p>}
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex items-center gap-2">
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">Save</button>
          <button type="button" onClick={onClose} className="px-2 text-sm text-slate-500 hover:text-slate-300">Cancel</button>
          <span className="flex-1" />
          {canModerate && (
            <button type="button" onClick={async () => { if (confirm(`Delete the project “${project.name}”, with all its tasks, reports and RAID items?`)) { const err = await send(base, 'DELETE'); if (err) setError(err); else onDeleted(); } }}
              className="text-sm text-rose-400 hover:text-rose-300">Delete project</button>
          )}
        </div>
      </form>
    </Sheet>
  );
}
