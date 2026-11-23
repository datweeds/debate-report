'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const inputCls = 'w-full rounded-lg border border-slate-700 bg-dr-surface px-3 py-2 text-sm text-slate-100';

// Status page, Sys Admin only: post an incident or planned maintenance, update it, resolve it
export function NewIncident() {
  const router = useRouter();
  const [title, setTitle] = useState(''), [body, setBody] = useState('');
  const [impact, setImpact] = useState('degraded'), [state, setState] = useState('investigating'), [startsAt, setStartsAt] = useState('');
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  async function post(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    const r = await fetch('/api/admin/status-incidents', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, impact, state, startsAt: startsAt || undefined }) });
    setBusy(false);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error ?? 'Couldn’t post'); return; }
    setTitle(''); setBody(''); router.refresh();
  }
  return (
    <form onSubmit={post} className="card-dr space-y-3 p-5">
      <p className="text-sm font-semibold text-slate-200">Post an incident or planned maintenance <span className="font-normal text-slate-500">(Sys Admin)</span></p>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Video calls unavailable" className={inputCls} maxLength={200} />
      <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="What's affected, what we're doing, when we'll update next" className={inputCls} />
      <div className="flex flex-wrap gap-2">
        <select value={impact} onChange={e => setImpact(e.target.value)} className="rounded-lg border border-slate-700 bg-dr-surface px-2 py-1.5 text-sm text-slate-200">
          <option value="outage">Outage</option><option value="degraded">Degraded</option><option value="maintenance">Maintenance</option><option value="security">Security</option>
        </select>
        <select value={state} onChange={e => setState(e.target.value)} className="rounded-lg border border-slate-700 bg-dr-surface px-2 py-1.5 text-sm text-slate-200">
          <option value="investigating">Investigating</option><option value="identified">Identified</option><option value="monitoring">Monitoring</option><option value="scheduled">Scheduled</option><option value="resolved">Resolved</option>
        </select>
        <input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} title="Start (for planned maintenance)" className="rounded-lg border border-slate-700 bg-dr-surface px-2 py-1.5 text-sm text-slate-200" />
        <button disabled={busy || title.trim().length < 3} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Post</button>
      </div>
      {err && <p className="text-xs text-rose-400">{err}</p>}
    </form>
  );
}

export function UpdateIncident({ id, state: initial }: { id: number; state: string }) {
  const router = useRouter();
  const [body, setBody] = useState(''), [state, setState] = useState(initial === 'scheduled' ? 'investigating' : initial), [busy, setBusy] = useState(false);
  async function save(next?: string) {
    setBusy(true);
    await fetch('/api/admin/status-incidents', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, state: next ?? state, body: body.trim() || undefined }) });
    setBusy(false); setBody(''); router.refresh();
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
      <input value={body} onChange={e => setBody(e.target.value)} placeholder="Replace the description (optional)" className="min-w-0 flex-1 rounded border border-slate-700 bg-dr-surface px-2 py-1 text-xs text-slate-200" />
      <select value={state} onChange={e => setState(e.target.value)} className="rounded border border-slate-700 bg-dr-surface px-2 py-1 text-xs text-slate-200">
        <option value="investigating">Investigating</option><option value="identified">Identified</option><option value="monitoring">Monitoring</option>
      </select>
      <button disabled={busy} onClick={() => save()} className="rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800">Update</button>
      <button disabled={busy} onClick={() => save('resolved')} className="rounded border border-emerald-700/60 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-950/40">Resolve</button>
    </div>
  );
}
