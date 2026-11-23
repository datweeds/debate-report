'use client';

import ReportButton from '@/components/ReportButton';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import RichText from '@/components/discussions/RichText';
import TaskTree, { type Task, type TaskGroup } from './TaskTree';
import Gantt from './Gantt';
import { RaidList, StatusReport, type Raid } from './Report';
import { Badge, FilterBar, fmtDate, inputCls, isFiltering, matchesFilter, PROJECT_STATUS, registerSealer, send, Sheet, TASK_STATUS, useFilter, type Filter, type Member } from './shared';
import SecureAccessDialog from '@/components/sealed/SecureAccessDialog';
import { useSecureAccess } from '@/components/sealed/useSecureAccess';
import { keysFor, newItemKeys, openItemText, sealItemText, sealItemTextOrNull, societyMembers, type ItemKeys } from '@/components/sealed/items';

type Project = {
  id: string; name: string; description: string | null; status: string; manager_id: string | null;
  start_date: string | null; end_date: string | null; protection: 'server' | 'sealed';
  manager: { id: string; user_handle: string; user_full_name: string | null } | null;
};
type Data = {
  project: Project; tasks: Task[]; groups: TaskGroup[]; raid: Raid[]; me: string | null;
  canManage: boolean; canModerate: boolean; canContribute: boolean; isManager: boolean; canSeal: boolean;
  reports: { id: string; body: string }[] | null;
};
const SEALED_PROJECT = 'Sealed project: its name, project tasks, comments, status reports, RAID log and group names are end-to-end encrypted, so only members can read them, not new.vote. Dates, statuses, allocations and dependencies stay visible, so the Gantt chart and date checks work. No AI, abuse scanning or Sys Admin emergency access.';
const TABS = [{ id: 'tasks', label: 'Project tasks' }, { id: 'gantt', label: 'Gantt' }, { id: 'report', label: 'Status report & RAID' }] as const;

export default function ProjectView({ societyId, projectId }: { societyId: number; projectId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const tab = (params.get('tab') ?? 'tasks') as typeof TABS[number]['id'];
  const base = `/api/societies/${societyId}/projects/${projectId}`;
  const [raw, setRaw] = useState<Data | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [openTask, setOpenTask] = useState<string | null>(null);
  const taskParam = params.get('task');
  useEffect(() => { if (taskParam) setOpenTask(taskParam); }, [taskParam]);
  const [settings, setSettings] = useState(false);
  const [filter, setFilter] = useFilter(`nv-project-tasks-filter-${projectId}`);
  // A sealed project: opened here with this person's keys, and sealed on the way out (see send())
  const societyBase = `/api/societies/${societyId}`;
  const access = useSecureAccess();
  const [keys, setKeys] = useState<ItemKeys | null>(null);
  const [keyError, setKeyError] = useState(false);
  const [dialog, setDialog] = useState<'setup' | 'unlock' | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(base);
    if (!r.ok) { setError(r.status === 404 ? 'This project no longer exists.' : 'Could not load the project.'); return; }
    setRaw(await r.json());
  }, [base]);
  useEffect(() => { load(); }, [load]);

  const sealed = raw?.project.protection === 'sealed';
  useEffect(() => {
    if (!sealed || access.status !== 'ready' || !access.identity || keys) return;
    keysFor(societyBase, 'project', projectId, access.identity).then(setKeys).catch(() => setKeyError(true));
  }, [sealed, access.status, access.identity, keys, societyBase, projectId]);
  // Writes to this project seal their text while its keys are here
  useEffect(() => {
    if (!sealed || !keys?.keys.has(keys.epoch)) { registerSealer(base, null); return; }
    registerSealer(base, { seal: v => sealItemText(keys, v), open: v => openItemText(keys, v) });
    return () => registerSealer(base, null);
  }, [sealed, keys, base]);
  useEffect(() => {
    if (!raw) return;
    if (!sealed) { setData(raw); return; }
    const o = (v: string | null | undefined) => openItemText(keys, v);
    setData({
      ...raw,
      project: { ...raw.project, name: o(raw.project.name) ?? 'Sealed project', description: o(raw.project.description) },
      tasks: raw.tasks.map(t => ({ ...t, name: o(t.name) ?? 'Sealed task', description: o(t.description), comments: o(t.comments),
        latest_report: t.latest_report && { ...t.latest_report, body: o(t.latest_report.body) ?? 'Sealed report' } })),
      raid: raw.raid.map(x => ({ ...x, name: o(x.name) ?? 'Sealed item', description: o(x.description) })),
      groups: (raw.groups ?? []).map(g => ({ ...g, name: o(g.name) ?? 'Sealed group' })),
    });
  }, [raw, keys, sealed]);

  // Seal (or unseal) the whole project: this browser re-encrypts all its text
  async function everything(): Promise<Data> {
    const r = await fetch(`${base}?all=1`);
    if (!r.ok) throw new Error('Couldn’t load the project');
    return r.json();
  }
  async function sealProject() {
    if (!confirm(`Seal this project?\n\n${SEALED_PROJECT}`)) return;
    if (access.status !== 'ready') { setDialog(access.status === 'locked' ? 'unlock' : 'setup'); return; }
    setError('');
    try {
      const [all, { members }] = await Promise.all([everything(), societyMembers(societyBase)]);
      const { keys: k, locks } = newItemKeys('project', projectId, members);
      const sl = (v: string | null | undefined) => sealItemTextOrNull(k, v);
      const r = await fetch(`${base}/seal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        action: 'seal', locks,
        project: { name: sealItemText(k, all.project.name), description: sl(all.project.description) },
        tasks: all.tasks.map(t => ({ id: t.id, name: sealItemText(k, t.name), description: sl(t.description), comments: sl(t.comments) })),
        reports: (all.reports ?? []).map(x => ({ id: x.id, body: sealItemText(k, x.body) })),
        raid: all.raid.map(x => ({ id: x.id, name: sealItemText(k, x.name), description: sl(x.description) })),
        groups: (all.groups ?? []).map(g => ({ id: g.id, name: sealItemText(k, g.name) })),
      }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Couldn’t seal the project');
      setKeys(k); setSettings(false); await load();
    } catch (e) { setError((e as Error).message); }
  }
  async function unsealProject() {
    if (!keys || !confirm('Unseal this project? Its text goes back to being encrypted on the server with the Society’s key, so AI, scanning and Sys Admin emergency access can reach it again.')) return;
    setError('');
    try {
      const all = await everything();
      const o = (v: string | null | undefined) => openItemText(keys, v);
      const body = {
        action: 'unseal',
        project: { name: o(all.project.name), description: o(all.project.description) },
        tasks: all.tasks.map(t => ({ id: t.id, name: o(t.name), description: o(t.description), comments: o(t.comments) })),
        reports: (all.reports ?? []).map(x => ({ id: x.id, body: o(x.body) })),
        raid: all.raid.map(x => ({ id: x.id, name: o(x.name), description: o(x.description) })),
        groups: (all.groups ?? []).map(g => ({ id: g.id, name: o(g.name) })),
      };
      if (!body.project.name || body.tasks.some(t => t.name == null)) throw new Error('Some of the project can’t be opened with your keys, so it can’t be unsealed from here');
      const r = await fetch(`${base}/seal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Couldn’t unseal the project');
      registerSealer(base, null); setKeys(null); setSettings(false); await load();
    } catch (e) { setError((e as Error).message); }
  }

  const go = (t: string) => router.replace(`/society/${societyId}/projects/${projectId}${t === 'tasks' ? '' : `?tab=${t}`}`);
  // Opening a task from the Gantt chart or report shows its sheet on the Tasks tab
  const openFromElsewhere = (id: string) => { go('tasks'); setOpenTask(id); };

  const keysPending = sealed && !keys && !keyError && (access.status === 'loading' || access.status === 'ready');
  if (!data || keysPending) return error ? <p className="text-sm text-rose-400">{error}</p> : <div className="h-40 rounded-2xl bg-slate-800/40 animate-pulse" />;
  const p = data.project;
  const canWrite = !sealed || !!keys?.keys.has(keys.epoch);

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
          <ReportButton kind="project" id={p.id} what="this project" sealed={p.protection === 'sealed'}
            shown={() => [p.name, p.description].filter(Boolean).join('\n')} />
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Project Manager: {p.manager ? <span className="text-slate-200">{p.manager.user_full_name ?? `@${p.manager.user_handle}`}</span> : <span className="text-amber-300">not yet chosen</span>}
          {data.isManager && <span className="text-emerald-300"> (you)</span>}
          {(p.start_date || p.end_date) && <> · {fmtDate(p.start_date) || '…'} – {fmtDate(p.end_date) || '…'}</>}
        </p>
        {p.description && <div className="mt-2"><RichText text={p.description} /></div>}
      </div>

      {dialog && <SecureAccessDialog mode={dialog} onDone={() => setDialog(null)} onClose={() => setDialog(null)} />}
      {sealed && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs text-slate-300 print:hidden">
          <span className="font-semibold text-emerald-300">🔐 </span>{SEALED_PROJECT}
          {access.status === 'none' && <> <button onClick={() => setDialog('setup')} className="font-semibold text-blue-300 hover:underline">Set up secure access</button> to read it.</>}
          {access.status === 'locked' && <> <button onClick={() => setDialog('unlock')} className="font-semibold text-blue-300 hover:underline">Unlock secure access</button> on this device to read it.</>}
          {access.status === 'ready' && keys && !keys.keys.size && <span className="text-amber-200"> Waiting for access: another member’s browser shares the key next time they open this project.</span>}
        </div>
      )}
      {error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}

      <nav className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-800 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden print:hidden">
        {TABS.map(t => (
          <button key={t.id} onClick={() => go(t.id)}
            className={`whitespace-nowrap border-b-2 -mb-px px-3 py-2 text-sm font-medium ${tab === t.id ? 'border-blue-500 text-blue-300' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {t.label}
          </button>
        ))}
      </nav>

      {(tab === 'tasks' || tab === 'gantt') && data.tasks.length > 0 && (() => {
        const n = data.tasks.filter(t => matchesFilter(filter, t.status, t.due_date ?? t.end_date)).length;
        return <FilterBar filter={filter} onChange={setFilter} statuses={TASK_STATUS} shown={n} total={data.tasks.length} noun="project tasks" />;
      })()}
      {tab === 'tasks' && (
        <TaskTree base={base} tasks={data.tasks} groups={data.groups ?? []} me={data.me} canManage={data.canManage && canWrite} onChanged={load} open={openTask} setOpen={setOpenTask}
          shownIds={isFiltering(filter) ? filteredIds(data.tasks, filter) : null} />
      )}
      {tab === 'gantt' && (() => {
        const ids = isFiltering(filter) ? filteredIds(data.tasks, filter) : null;
        return <Gantt tasks={ids ? data.tasks.filter(t => ids.has(t.id)) : data.tasks} groups={data.groups ?? []} projectStart={p.start_date} projectEnd={p.end_date} onOpen={openFromElsewhere} />;
      })()}
      {tab === 'report' && (
        <div className="space-y-8">
          <StatusReport base={base} tasks={data.tasks} onOpen={openFromElsewhere} />
          <RaidList base={base} raid={data.raid} me={data.me} canManage={data.canManage && canWrite} canContribute={data.canContribute && canWrite} onChanged={load} />
        </div>
      )}

      {settings && (
        <ProjectSettings societyId={societyId} base={base} project={p} canModerate={data.canModerate}
          sealing={data.canSeal && !sealed ? sealProject : undefined} unsealing={sealed && keys?.keys.size ? unsealProject : undefined}
          onClose={() => setSettings(false)} onSaved={() => { setSettings(false); load(); }}
          onDeleted={() => router.push(`/society/${societyId}/projects`)} />
      )}
    </div>
  );
}

function ProjectSettings({ societyId, base, project, canModerate, sealing, unsealing, onClose, onSaved, onDeleted }: {
  societyId: number; base: string; project: Project; canModerate: boolean; onClose: () => void; onSaved: () => void; onDeleted: () => void;
  sealing?: () => void; unsealing?: () => void;   // seal or unseal the whole project
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
        {!canModerate && <p className="text-[11px] text-slate-500">Only a Society Admin can rename the project or change its Project Manager.</p>}
        {sealing && (
          <button type="button" onClick={sealing} className="rounded-lg border border-emerald-600/50 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10">🔐 Seal this project</button>
        )}
        {unsealing && (
          <button type="button" onClick={unsealing} className="text-xs text-slate-400 hover:text-slate-200 hover:underline">Unseal this project</button>
        )}
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex items-center gap-2">
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">Save</button>
          <button type="button" onClick={onClose} className="px-2 text-sm text-slate-500 hover:text-slate-300">Cancel</button>
          <span className="flex-1" />
          {canModerate && (
            <button type="button" onClick={async () => { if (confirm(`Delete the project “${project.name}”, with all its project tasks, reports and RAID items?`)) { const err = await send(base, 'DELETE'); if (err) setError(err); else onDeleted(); } }}
              className="text-sm text-rose-400 hover:text-rose-300">Delete project</button>
          )}
        </div>
      </form>
    </Sheet>
  );
}

// The project tasks that match the filter (due date, or end date if none),
// plus the parents of any matching sub-task so it still shows in its place.
function filteredIds(tasks: Task[], f: Filter): Set<string> {
  const byId = new Map(tasks.map(t => [t.id, t]));
  const ids = new Set<string>();
  for (const t of tasks) {
    if (!matchesFilter(f, t.status, t.due_date ?? t.end_date)) continue;
    for (let c: Task | undefined = t; c && !ids.has(c.id); c = c.parent_id ? byId.get(c.parent_id) : undefined) ids.add(c.id);
  }
  return ids;
}
