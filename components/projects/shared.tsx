'use client';

import { useEffect, useState } from 'react';

// Shared bits for the Projects screens.

export type Member = { id: string; handle: string; name: string | null };

export const TASK_STATUS: Record<string, { label: string; cls: string; bar: string }> = {
  new:         { label: 'New',         cls: 'bg-slate-500/20 text-slate-300 border-slate-500/40',       bar: 'bg-slate-400' },
  in_progress: { label: 'In progress', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/40',          bar: 'bg-blue-500' },
  paused:      { label: 'Paused',      cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40',       bar: 'bg-amber-500' },
  complete:    { label: 'Complete',    cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40', bar: 'bg-emerald-500' },
};

export const PROJECT_STATUS: Record<string, { label: string; cls: string }> = {
  active:   { label: 'Active',   cls: 'bg-blue-500/15 text-blue-300 border-blue-500/40' },
  on_hold:  { label: 'On hold',  cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
  complete: { label: 'Complete', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
};

export const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none';

export function fmtDate(d: string | null | undefined) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Filters: one or more statuses, and how soon something is due ────────────
export const DUE_WINDOWS = [
  { id: 'all', label: 'Any due date', days: null },
  { id: '7', label: 'Due within 7 days', days: 7 },
  { id: '14', label: 'Due within 14 days', days: 14 },
  { id: '30', label: 'Due within a month', days: 30 },
  { id: '90', label: 'Due within 3 months', days: 90 },
] as const;
export type Filter = { statuses: string[]; due: string };
const NO_FILTER: Filter = { statuses: [], due: 'all' };

/** Is this date within the window? Overdue counts (it's due now); no date doesn't. */
export function dueWithin(date: string | null | undefined, due: string): boolean {
  const w = DUE_WINDOWS.find(x => x.id === due);
  if (!w?.days) return true;
  if (!date) return false;
  const limit = new Date(); limit.setDate(limit.getDate() + w.days);
  const key = `${limit.getFullYear()}-${String(limit.getMonth() + 1).padStart(2, '0')}-${String(limit.getDate()).padStart(2, '0')}`;
  return date.slice(0, 10) <= key;
}
export const matchesFilter = (f: Filter, status: string, date: string | null | undefined) =>
  (!f.statuses.length || f.statuses.includes(status)) && dueWithin(date, f.due);
export const isFiltering = (f: Filter) => f.statuses.length > 0 || f.due !== 'all';

/** A filter remembered in this browser (per screen). */
export function useFilter(storeKey: string): [Filter, (f: Filter) => void] {
  const [f, setF] = useState<Filter>(NO_FILTER);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(storeKey) ?? 'null');
      if (v && Array.isArray(v.statuses) && typeof v.due === 'string') setF({ statuses: v.statuses, due: v.due });
    } catch { /* storage blocked */ }
  }, [storeKey]);
  const set = (next: Filter) => { setF(next); try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* storage blocked */ } };
  return [f, set];
}

export function FilterBar({ filter, onChange, statuses, shown, total, noun }: {
  filter: Filter; onChange: (f: Filter) => void; statuses: Record<string, { label: string; cls: string }>;
  shown: number; total: number; noun: string;
}) {
  const toggle = (k: string) => onChange({ ...filter, statuses: filter.statuses.includes(k) ? filter.statuses.filter(s => s !== k) : [...filter.statuses, k] });
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <span className="text-[11px] text-slate-500">Status:</span>
      {Object.entries(statuses).map(([k, v]) => {
        const on = filter.statuses.includes(k);
        return (
          <button key={k} type="button" onClick={() => toggle(k)} aria-pressed={on}
            className={`rounded border px-2 py-0.5 text-[11px] font-semibold transition-colors ${on ? v.cls : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}>
            {on && '✓ '}{v.label}
          </button>
        );
      })}
      <select value={filter.due} onChange={e => onChange({ ...filter, due: e.target.value })} aria-label="Due date"
        className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-300">
        {DUE_WINDOWS.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
      </select>
      {isFiltering(filter) && (
        <>
          <span className="text-[11px] text-slate-500">{shown} of {total} {noun}</span>
          <button type="button" onClick={() => onChange(NO_FILTER)} className="text-[11px] text-blue-400 hover:text-blue-300">Clear</button>
        </>
      )}
    </div>
  );
}

export function Badge({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${cls}`}>{children}</span>;
}

export function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
      <span className="w-9 text-right text-[11px] tabular-nums text-slate-400">{pct}%</span>
    </div>
  );
}

// A bottom sheet on phones, a centred dialog elsewhere.
// A pop-up for project forms. Only its ✕ button closes it: a stray click
// outside mustn't throw away what someone is typing.
export function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4">
      <div role="dialog" aria-modal="true" aria-label={title}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-dr-card p-5 sm:max-w-xl shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// A sealed project registers how to seal and open its text here (by its API
// base); every send() to that project then seals its text fields on the way out.
type Sealer = { seal: (v: string) => string; open: (v: string | null | undefined) => string | null };
const sealers = new Map<string, Sealer>();
const TEXT_FIELDS = ['name', 'description', 'comments', 'body', 'newGroup'];
export function registerSealer(base: string, s: Sealer | null) { if (s) sealers.set(base, s); else sealers.delete(base); }
const sealerFor = (url: string) => [...sealers.entries()].find(([b]) => url === b || url.startsWith(`${b}/`))?.[1];
/** Open text from a sealed project (unchanged elsewhere; null if it can't be opened). */
export const openFor = (url: string, v: string | null | undefined) => { const s = sealerFor(url); return s ? s.open(v) : v ?? null; };

export async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  const sealer = sealerFor(url);
  if (sealer && body && typeof body === 'object' && !Array.isArray(body)) {
    const b = { ...(body as Record<string, unknown>) };
    for (const k of TEXT_FIELDS) if (typeof b[k] === 'string' && (b[k] as string).trim()) b[k] = sealer.seal((b[k] as string).trim());
    body = b;
  }
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (!r.ok) return (await r.json().catch(() => ({}))).error ?? 'Something went wrong';
  return null;
}
