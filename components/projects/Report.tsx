'use client';

import { useState } from 'react';
import RichText from '@/components/discussions/RichText';
import { buildTree, flatten, isOverdue, type Report as TaskReport, type Task } from './TaskTree';
import { Badge, fmtDate, inputCls, ProgressBar, send, TASK_STATUS } from './shared';

export type Raid = {
  id: string; kind: 'risk' | 'issue' | 'dependency' | 'assumption'; name: string; description: string | null;
  impact: 'low' | 'medium' | 'high'; likelihood: 'low' | 'medium' | 'high'; status: 'open' | 'mitigated' | 'closed';
  created_at: string; created_by: string | null; created_by_handle: string | null;
};

const KIND: Record<Raid['kind'], { label: string; plural: string; cls: string }> = {
  risk:       { label: 'Risk',       plural: 'Risks',        cls: 'bg-rose-500/15 text-rose-300 border-rose-500/40' },
  issue:      { label: 'Issue',      plural: 'Issues',       cls: 'bg-orange-500/15 text-orange-300 border-orange-500/40' },
  dependency: { label: 'Dependency', plural: 'Dependencies', cls: 'bg-violet-500/15 text-violet-300 border-violet-500/40' },
  assumption: { label: 'Assumption', plural: 'Assumptions',  cls: 'bg-sky-500/15 text-sky-300 border-sky-500/40' },
};
const LEVEL_CLS = { low: 'text-emerald-300', medium: 'text-amber-300', high: 'text-rose-300' } as const;
const RAID_STATUS: Record<Raid['status'], string> = { open: 'Open', mitigated: 'Mitigated', closed: 'Closed' };

const when = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

// ── Project status report ────────────────────────────────────────────────────

export function StatusReport({ base, tasks, onOpen }: { base: string; tasks: Task[]; onOpen: (id: string) => void }) {
  const rows = flatten(buildTree(tasks));
  const [history, setHistory] = useState<Record<string, (TaskReport & { id: string })[] | 'loading'>>({});
  const count = (s: string) => tasks.filter(t => t.status === s).length;
  const overdue = tasks.filter(isOverdue).length;

  async function toggleHistory(taskId: string) {
    if (history[taskId]) { setHistory(h => { const n = { ...h }; delete n[taskId]; return n; }); return; }
    setHistory(h => ({ ...h, [taskId]: 'loading' }));
    const r = await fetch(`${base}/tasks/${taskId}/reports`);
    const d = r.ok ? await r.json() : { reports: [] };
    setHistory(h => ({ ...h, [taskId]: d.reports }));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ['Tasks', tasks.length, 'text-slate-100'],
          ['Complete', count('complete'), 'text-emerald-300'],
          ['In progress', count('in_progress'), 'text-blue-300'],
          ['Not started', count('new'), 'text-slate-300'],
          ['Overdue', overdue, overdue ? 'text-rose-400' : 'text-slate-300'],
        ].map(([label, n, cls]) => (
          <div key={label as string} className="rounded-xl border border-slate-800 bg-[#0c1322] px-3 py-2">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
            <p className={`text-2xl font-bold tabular-nums ${cls}`}>{n}</p>
          </div>
        ))}
      </div>
      <ProgressBar done={count('complete')} total={tasks.length} />

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No tasks yet.</p>
      ) : (
        <ul className="divide-y divide-slate-800/60 overflow-hidden rounded-2xl border border-slate-800 bg-[#0c1322]">
          {rows.map(t => {
            const h = history[t.id];
            return (
              <li key={t.id} className="px-4 py-3" style={{ paddingLeft: `${1 + t.depth * 1.25}rem` }}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge cls={TASK_STATUS[t.status].cls}>{TASK_STATUS[t.status].label}</Badge>
                  <button onClick={() => onOpen(t.id)} className="text-left text-sm font-medium text-slate-100 hover:text-blue-300">{t.name}</button>
                  <span className="text-[11px] text-slate-500">
                    {t.assignees.map(a => `@${a.handle}`).join(', ') || 'Unallocated'}
                    {t.due_date && <span className={isOverdue(t) ? ' font-semibold text-rose-400' : ''}> · due {fmtDate(t.due_date)}</span>}
                  </span>
                </div>
                {t.latest_report ? (
                  <div className="mt-2 rounded-lg border border-slate-800 px-3 py-2">
                    <p className="text-[11px] text-slate-500">Latest report · @{t.latest_report.by ?? 'unknown'} · {when(t.latest_report.created_at)}</p>
                    <div className="mt-0.5 line-clamp-3"><RichText text={t.latest_report.body} /></div>
                  </div>
                ) : <p className="mt-1 text-[11px] text-slate-600">No status report yet.</p>}
                {t.report_count > 1 && (
                  <button onClick={() => toggleHistory(t.id)} className="mt-1.5 text-[11px] text-blue-400 hover:underline">
                    {h ? 'Hide earlier reports' : `Earlier reports (${t.report_count - 1})`}
                  </button>
                )}
                {Array.isArray(h) && (
                  <ol className="mt-2 space-y-1.5 border-l border-slate-700 pl-3">
                    {h.slice(1).map(r => (
                      <li key={r.id}>
                        <p className="text-[11px] text-slate-500">@{r.by ?? 'unknown'} · {when(r.created_at)} · {TASK_STATUS[r.status]?.label}</p>
                        <RichText text={r.body} />
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── RAID log ─────────────────────────────────────────────────────────────────

export function RaidList({ base, raid, me, canManage, canContribute, onChanged }: {
  base: string; raid: Raid[]; me: string | null; canManage: boolean; canContribute: boolean; onChanged: () => void;
}) {
  const [filter, setFilter] = useState<'all' | Raid['kind']>('all');
  const [form, setForm] = useState<Partial<Raid> | null>(null);
  const [error, setError] = useState('');
  const shown = raid.filter(r => filter === 'all' || r.kind === filter);
  const canEdit = (r: Raid) => r.created_by === me || canManage;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const err = form.id ? await send(`${base}/raid/${form.id}`, 'PATCH', form) : await send(`${base}/raid`, 'POST', form);
    if (err) setError(err); else { setForm(null); setError(''); onChanged(); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-2 text-base font-semibold text-slate-100">RAID log</h3>
        {(['all', 'risk', 'issue', 'dependency', 'assumption'] as const).map(k => (
          <button key={k} onClick={() => setFilter(k)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${filter === k ? (k === 'all' ? 'border-slate-400 bg-slate-700/40 text-slate-200' : KIND[k].cls) : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}>
            {k === 'all' ? `All (${raid.length})` : `${KIND[k].plural} (${raid.filter(r => r.kind === k).length})`}
          </button>
        ))}
        <span className="flex-1" />
        {canContribute && !form && (
          <button onClick={() => setForm({ kind: filter === 'all' ? 'risk' : filter, impact: 'medium', likelihood: 'medium', status: 'open' })}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500">+ Add item</button>
        )}
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}

      {form && (
        <form onSubmit={save} className="space-y-3 rounded-2xl border border-slate-700 bg-[#0c1322] p-4">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(KIND) as Raid['kind'][]).map(k => (
              <button key={k} type="button" onClick={() => setForm(f => ({ ...f, kind: k }))}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${form.kind === k ? KIND[k].cls : 'border-slate-700 text-slate-500'}`}>{KIND[k].label}</button>
            ))}
          </div>
          <input value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required maxLength={200} placeholder="Name" className={inputCls} autoFocus />
          <textarea value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} maxLength={5000} placeholder="Description" className={inputCls} />
          <div className="grid grid-cols-3 gap-2">
            {(['impact', 'likelihood'] as const).map(k => (
              <label key={k} className="text-xs capitalize text-slate-400">{k}
                <select value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className={`${inputCls} mt-1`}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              </label>
            ))}
            <label className="text-xs text-slate-400">Status
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Raid['status'] }))} className={`${inputCls} mt-1`}>
                {Object.entries(RAID_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">{form.id ? 'Save' : 'Add'}</button>
            <button type="button" onClick={() => setForm(null)} className="px-2 text-sm text-slate-500 hover:text-slate-300">Cancel</button>
          </div>
        </form>
      )}

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-slate-800 bg-[#0c1322] p-6 text-center text-sm text-slate-500">Nothing logged{filter !== 'all' ? ` as ${KIND[filter].plural.toLowerCase()}` : ''} yet.</p>
      ) : (
        <ul className="divide-y divide-slate-800/60 overflow-hidden rounded-2xl border border-slate-800 bg-[#0c1322]">
          {shown.map(r => (
            <li key={r.id} className={`px-4 py-3 ${r.status === 'closed' ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge cls={KIND[r.kind].cls}>{KIND[r.kind].label}</Badge>
                <span className="text-sm font-medium text-slate-100">{r.name}</span>
                <span className="text-[11px] text-slate-500">
                  Impact <span className={LEVEL_CLS[r.impact]}>{r.impact}</span> · Likelihood <span className={LEVEL_CLS[r.likelihood]}>{r.likelihood}</span>
                </span>
                <span className="flex-1" />
                {canEdit(r) ? (
                  <select value={r.status} aria-label="Status"
                    onChange={async e => { const err = await send(`${base}/raid/${r.id}`, 'PATCH', { status: e.target.value }); if (err) setError(err); else onChanged(); }}
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs text-slate-200">
                    {Object.entries(RAID_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                ) : <span className="text-xs text-slate-400">{RAID_STATUS[r.status]}</span>}
              </div>
              {r.description && <div className="mt-1"><RichText text={r.description} /></div>}
              <p className="mt-1 text-[11px] text-slate-600">
                Logged by @{r.created_by_handle ?? 'unknown'}, {when(r.created_at)}
                {canEdit(r) && (
                  <>
                    {' · '}<button onClick={() => setForm(r)} className="text-slate-400 hover:text-slate-200">Edit</button>
                    {' · '}<button onClick={async () => { if (confirm(`Delete “${r.name}”?`)) { await send(`${base}/raid/${r.id}`, 'DELETE'); onChanged(); } }} className="text-rose-400 hover:text-rose-300">Delete</button>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
