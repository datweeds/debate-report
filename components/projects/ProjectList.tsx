'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Badge, fmtDate, inputCls, PROJECT_STATUS, ProgressBar, type Member } from './shared';

type Row = {
  id: string; name: string; description: string | null; status: string; start_date: string | null; end_date: string | null;
  manager: string | null; task_count: number; done_count: number; overdue_count: number; open_raid: number;
};

// A Society's projects; moderators create them and choose the Project Manager.
export default function ProjectList({ societyId }: { societyId: number }) {
  const base = `/api/societies/${societyId}/projects`;
  const [data, setData] = useState<{ projects: Row[]; canCreate: boolean } | null>(null);
  const [creating, setCreating] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [f, setF] = useState({ name: '', description: '', managerId: '', startDate: '', endDate: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(base);
    if (r.ok) setData(await r.json()); else setError('Could not load projects.');
  }, [base]);
  useEffect(() => { load(); }, [load]);

  async function openCreate() {
    setCreating(true);
    const r = await fetch(`/api/societies/${societyId}/members`);
    if (r.ok) setMembers((await r.json()).members);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    const r = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, managerId: f.managerId || null }) });
    setSaving(false);
    if (!r.ok) { setError((await r.json()).error ?? 'Could not create the project'); return; }
    window.location.href = `/society/${societyId}/projects/${(await r.json()).id}`;
  }

  if (!data) return error ? <p className="text-sm text-rose-400">{error}</p> : <div className="h-40 rounded-2xl bg-slate-800/40 animate-pulse" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">Work this Society&apos;s members are doing together.</p>
        {data.canCreate && !creating && (
          <button onClick={openCreate} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">+ New project</button>
        )}
      </div>

      {creating && (
        <form onSubmit={create} className="space-y-3 rounded-2xl border border-slate-700 bg-[#0c1322] p-4">
          <input value={f.name} onChange={e => setF(v => ({ ...v, name: e.target.value }))} required maxLength={200} placeholder="Project name" className={inputCls} autoFocus />
          <textarea value={f.description} onChange={e => setF(v => ({ ...v, description: e.target.value }))} rows={3} maxLength={5000} placeholder="What the project is for (optional)" className={inputCls} />
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs text-slate-400">Project Manager
              <select value={f.managerId} onChange={e => setF(v => ({ ...v, managerId: e.target.value }))} className={`${inputCls} mt-1`}>
                <option value="">Choose later</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name ? `${m.name} (@${m.handle})` : `@${m.handle}`}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-400">Starts
              <input type="date" value={f.startDate} onChange={e => setF(v => ({ ...v, startDate: e.target.value }))} className={`${inputCls} mt-1`} />
            </label>
            <label className="text-xs text-slate-400">Ends
              <input type="date" value={f.endDate} min={f.startDate || undefined} onChange={e => setF(v => ({ ...v, endDate: e.target.value }))} className={`${inputCls} mt-1`} />
            </label>
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">{saving ? 'Creating…' : 'Create project'}</button>
            <button type="button" onClick={() => setCreating(false)} className="px-2 text-sm text-slate-500 hover:text-slate-300">Cancel</button>
          </div>
        </form>
      )}

      {data.projects.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-10 text-center text-sm text-slate-500">No projects yet.</div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.projects.map(p => (
            <li key={p.id}>
              <Link href={`/society/${societyId}/projects/${p.id}`} className="block h-full rounded-2xl border border-slate-800 bg-[#0c1322] p-4 hover:border-slate-600 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-100">{p.name}</h3>
                  <Badge cls={PROJECT_STATUS[p.status]?.cls ?? ''}>{PROJECT_STATUS[p.status]?.label ?? p.status}</Badge>
                </div>
                {p.description && <p className="mt-1 line-clamp-2 text-xs text-slate-400">{p.description}</p>}
                <p className="mt-2 text-xs text-slate-500">
                  {p.manager ? `PM @${p.manager}` : 'No Project Manager yet'}
                  {(p.start_date || p.end_date) && ` · ${fmtDate(p.start_date) || '…'} – ${fmtDate(p.end_date) || '…'}`}
                </p>
                <div className="mt-3"><ProgressBar done={p.done_count} total={p.task_count} /></div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {p.done_count}/{p.task_count} tasks complete
                  {p.overdue_count > 0 && <span className="text-rose-400"> · {p.overdue_count} overdue</span>}
                  {p.open_raid > 0 && <span className="text-amber-300"> · {p.open_raid} open RAID</span>}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
