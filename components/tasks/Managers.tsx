'use client';

import { useState } from 'react';
import { Chip, Modal, send, smallInput, type Swatch } from './shared';

const PALETTE = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'];

// Your categories, or (moderators) the Society's priorities: add, rename,
// recolour, reorder and delete. Changes save as you make them.
export default function SwatchManager({ title, intro, url, items, onChanged, onClose, min = 0, counts, countNote }: {
  title: string; intro: string; url: string; items: Swatch[]; onChanged: () => void; onClose: () => void; min?: number;
  counts?: Record<string, { n: number; open: number }>; countNote?: string;   // tasks using each one
}) {
  const [list, setList] = useState(items);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[(items.length + 5) % PALETTE.length]);
  const [error, setError] = useState('');

  async function act(p: Promise<{ ok: boolean; data: Record<string, unknown> }>) {
    const r = await p;
    if (!r.ok) { setError(String(r.data.error ?? 'Couldn’t save')); return null; }
    setError(''); onChanged(); return r.data;
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const d = await act(send(url, 'POST', { name, color }));
    const made = (d?.category ?? d?.priority) as Swatch | undefined;
    if (made) { setList(l => [...l, made]); setName(''); setColor(PALETTE[(list.length + 6) % PALETTE.length]); }
  }
  async function update(s: Swatch, patch: Partial<Swatch>) {
    setList(l => l.map(x => x.id === s.id ? { ...x, ...patch } : x));
    await act(send(`${url}/${s.id}`, 'PATCH', { name: patch.name, color: patch.color }));
  }
  async function remove(s: Swatch) {
    const n = counts?.[s.id]?.n ?? 0;
    if (!confirm(`Delete “${s.name}”? It’s taken off every task that has it${n ? ` (${n} task${n === 1 ? '' : 's'})` : ''}.`)) return;
    if (await act(send(`${url}/${s.id}`, 'DELETE'))) setList(l => l.filter(x => x.id !== s.id));
  }
  async function move(i: number, d: -1 | 1) {
    const next = [...list];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
    await Promise.all(next.map((s, k) => send(`${url}/${s.id}`, 'PATCH', { sortOrder: k })));
    onChanged();
  }

  return (
    <Modal onClose={onClose} label={title}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-700/50 hover:text-white">×</button>
        </div>
        <p className="text-xs text-slate-400">{intro}</p>
        {counts && <p className="text-[11px] text-slate-500">Numbers: tasks using each one · of those, not complete{countNote ? ` (${countNote})` : ''}.</p>}
        <ul className="space-y-1.5">
          {list.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2">
              <input type="color" value={s.color} onChange={e => update(s, { color: e.target.value })} aria-label={`Colour of ${s.name}`} className="h-7 w-8 cursor-pointer rounded border border-slate-700 bg-transparent" />
              <input defaultValue={s.name} maxLength={60} aria-label="Name"
                onBlur={e => { const v = e.target.value.trim(); if (v && v !== s.name) void update(s, { name: v }); }}
                className={`${smallInput} min-w-0 flex-1`} />
              <Chip s={s} />
              {counts && (
                <span className="w-14 shrink-0 text-right text-xs tabular-nums text-slate-400" title={`${counts[s.id]?.n ?? 0} task${counts[s.id]?.n === 1 ? '' : 's'}, ${counts[s.id]?.open ?? 0} not complete`}>
                  {counts[s.id]?.n ?? 0}<span className="text-slate-600"> · {counts[s.id]?.open ?? 0}</span>
                </span>
              )}
              <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="px-1 text-slate-400 hover:text-slate-200 disabled:opacity-30">↑</button>
              <button onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Move down" className="px-1 text-slate-400 hover:text-slate-200 disabled:opacity-30">↓</button>
              <button onClick={() => remove(s)} disabled={list.length <= min} className="px-1 text-xs text-rose-400 hover:text-rose-300 disabled:opacity-30">Delete</button>
            </li>
          ))}
          {!list.length && <li className="text-xs text-slate-500">None yet.</li>}
        </ul>
        <form onSubmit={add} className="flex items-center gap-2 border-t border-slate-700/60 pt-3">
          <input type="color" value={color} onChange={e => setColor(e.target.value)} aria-label="Colour" className="h-7 w-8 cursor-pointer rounded border border-slate-700 bg-transparent" />
          <input value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="New one…" className={`${smallInput} min-w-0 flex-1`} />
          <button type="submit" disabled={!name.trim()} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50">Add</button>
        </form>
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>
    </Modal>
  );
}
