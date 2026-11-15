'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import RichText from '@/components/discussions/RichText';

type Ev = {
  id: string; title: string; description: string | null; location: string | null;
  starts_at: string; ends_at: string | null; all_day: boolean; created_by_handle: string | null;
};
// A project task on its due date ('YYYY-MM-DD', a calendar date with no time zone).
type Task = { id: string; title: string; project: string; due_at: string; status: string; href: string };

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none';

// ── Date helpers ─────────────────────────────────────────────────────────────
// Timed events use the viewer's local time. All-day events are stored at
// midnight UTC on their dates, so they're read with UTC parts.
const pad = (n: number) => String(n).padStart(2, '0');
const localKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const utcKey = (d: Date) => d.toISOString().slice(0, 10);

function eventDays(e: Ev): [string, string] {
  const s = new Date(e.starts_at), en = new Date(e.ends_at ?? e.starts_at);
  return e.all_day ? [utcKey(s), utcKey(en)] : [localKey(s), localKey(en)];
}
const onDay = (e: Ev, key: string) => { const [a, b] = eventDays(e); return a <= key && key <= b; };

function timeLabel(e: Ev) {
  if (e.all_day) return 'All day';
  return new Date(e.starts_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function rangeLabel(e: Ev) {
  const s = new Date(e.starts_at), en = e.ends_at ? new Date(e.ends_at) : null;
  const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' };
  if (e.all_day) {
    const a = s.toLocaleDateString('en-GB', { ...dateOpts, timeZone: 'UTC' });
    if (!en || utcKey(en) === utcKey(s)) return `${a} · all day`;
    return `${a} – ${en.toLocaleDateString('en-GB', { ...dateOpts, timeZone: 'UTC' })}`;
  }
  const t = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (!en) return `${s.toLocaleDateString('en-GB', dateOpts)} · ${t(s)}`;
  if (localKey(s) === localKey(en)) return `${s.toLocaleDateString('en-GB', dateOpts)} · ${t(s)}–${t(en)}`;
  return `${s.toLocaleDateString('en-GB', dateOpts)} ${t(s)} – ${en.toLocaleDateString('en-GB', dateOpts)} ${t(en)}`;
}

// 6 weeks of days, starting on the Monday on/before the 1st of the month
function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - offset + i));
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SocietyCalendar({ societyId }: { societyId: number }) {
  const base = `/api/societies/${societyId}/events`;
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [view, setView] = useState<'month' | 'list'>('month');
  const [showEvents, setShowEvents] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [data, setData] = useState<{ events: Ev[]; tasks: Task[]; canModerate: boolean } | null>(null);
  const [selectedDay, setSelectedDay] = useState(localKey(today));
  const [open, setOpen] = useState<Ev | null>(null);
  const [editing, setEditing] = useState<Partial<FormState> | null>(null);
  const [error, setError] = useState('');

  const grid = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);

  const load = useCallback(async () => {
    const from = view === 'month' ? grid[0] : new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const to = view === 'month' ? new Date(grid[41].getTime() + 86400000) : new Date(from.getTime() + 120 * 86400000);
    const r = await fetch(`${base}?from=${from.toISOString()}&to=${to.toISOString()}`);
    if (r.ok) setData(await r.json()); else setError('Could not load the calendar.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, grid, view]);
  useEffect(() => { load(); }, [load]);

  const events = showEvents ? data?.events ?? [] : [];
  const tasks = showTasks ? data?.tasks ?? [] : [];
  const dayItems = (key: string) => ({
    ev: events.filter(e => onDay(e, key)),
    tk: tasks.filter(t => t.due_at === key),
  });

  function move(delta: number) {
    setCursor(c => { const d = new Date(c.y, c.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  }

  async function remove(e: Ev) {
    if (!confirm(`Delete "${e.title}"?`)) return;
    await fetch(`${base}/${e.id}`, { method: 'DELETE' });
    setOpen(null); load();
  }

  if (!data) return error ? <p className="text-sm text-rose-400">{error}</p> : <div className="h-96 rounded-2xl bg-slate-800/40 animate-pulse" />;

  const monthName = new Date(cursor.y, cursor.m, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const sel = dayItems(selectedDay);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {view === 'month' && (
          <div className="flex items-center gap-1">
            <button onClick={() => move(-1)} aria-label="Previous month" className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-sm text-slate-300 hover:border-slate-500">‹</button>
            <button onClick={() => move(1)} aria-label="Next month" className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-sm text-slate-300 hover:border-slate-500">›</button>
            <button onClick={() => { setCursor({ y: today.getFullYear(), m: today.getMonth() }); setSelectedDay(localKey(today)); }}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500">Today</button>
            <h2 className="ml-2 text-base font-semibold text-slate-100">{monthName}</h2>
          </div>
        )}
        {view === 'list' && <h2 className="text-base font-semibold text-slate-100">Upcoming</h2>}
        <span className="flex-1" />
        <label className="flex items-center gap-1.5 text-xs text-slate-400">
          <input type="checkbox" checked={showEvents} onChange={e => setShowEvents(e.target.checked)} className="accent-blue-500" /> Events
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-400" title="Project tasks with due dates">
          <input type="checkbox" checked={showTasks} onChange={e => setShowTasks(e.target.checked)} className="accent-amber-500" /> Project tasks
        </label>
        <div className="flex overflow-hidden rounded-lg border border-slate-700 text-xs">
          {(['month', 'list'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 ${view === v ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}>
              {v === 'month' ? 'Month' : 'List'}
            </button>
          ))}
        </div>
        {data.canModerate && (
          <button onClick={() => setEditing({ date: selectedDay })} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500">+ Add event</button>
        )}
      </div>

      {view === 'month' ? (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0c1322]">
            <div className="grid grid-cols-7 border-b border-slate-800 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {WEEKDAYS.map(d => <div key={d} className="py-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {grid.map(d => {
                const key = localKey(d);
                const inMonth = d.getMonth() === cursor.m;
                const isToday = key === localKey(today);
                const { ev, tk } = dayItems(key);
                const count = ev.length + tk.length;
                return (
                  <div key={key}
                    onClick={() => setSelectedDay(key)}
                    onDoubleClick={() => data.canModerate && setEditing({ date: key })}
                    className={`min-h-[3.25rem] sm:min-h-[6.5rem] cursor-pointer border-b border-r border-slate-800/70 p-1 sm:p-1.5 transition-colors ${
                      selectedDay === key ? 'bg-blue-500/10' : 'hover:bg-slate-800/30'} ${inMonth ? '' : 'opacity-40'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${isToday ? 'bg-blue-600 font-bold text-white' : 'text-slate-300'}`}>{d.getDate()}</span>
                    </div>
                    {/* Phones: dots */}
                    {count > 0 && (
                      <div className="mt-1 flex justify-center gap-0.5 sm:hidden">
                        {ev.slice(0, 3).map(e => <span key={e.id} className="h-1.5 w-1.5 rounded-full bg-blue-400" />)}
                        {tk.slice(0, 2).map(t => <span key={t.id} className="h-1.5 w-1.5 rounded-full bg-amber-400" />)}
                      </div>
                    )}
                    {/* Larger screens: chips */}
                    <div className="mt-1 hidden space-y-0.5 sm:block">
                      {ev.slice(0, 3).map(e => (
                        <button key={e.id} onClick={ev2 => { ev2.stopPropagation(); setOpen(e); }}
                          className="block w-full truncate rounded bg-blue-500/20 px-1.5 py-0.5 text-left text-[11px] text-blue-100 hover:bg-blue-500/30">
                          {!e.all_day && <span className="text-blue-300">{timeLabel(e)} </span>}{e.title}
                        </button>
                      ))}
                      {tk.slice(0, Math.max(0, 3 - ev.length)).map(t => (
                        <a key={t.id} href={t.href} onClick={e2 => e2.stopPropagation()}
                          className="block truncate rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-100 hover:bg-amber-500/25">
                          ◆ {t.title}
                        </a>
                      ))}
                      {count > 3 && <p className="px-1 text-[10px] text-slate-500">+{count - 3} more</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* The selected day's items (the main view on phones) */}
          <DayList
            title={new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            events={sel.ev} tasks={sel.tk} onOpen={setOpen}
            empty={data.canModerate ? 'Nothing on this day. Double-click a day, or use “Add event”.' : 'Nothing on this day.'}
          />
        </>
      ) : (
        <UpcomingList events={events} tasks={tasks} onOpen={setOpen} />
      )}

      {open && (
        <Modal onClose={() => setOpen(null)}>
          <h3 className="text-lg font-semibold text-slate-100">{open.title}</h3>
          <p className="mt-1 text-sm text-blue-300">{rangeLabel(open)}</p>
          {open.location && <div className="mt-3 flex gap-2 text-sm text-slate-300"><span aria-hidden>📍</span><RichText text={open.location} /></div>}
          {open.description && <div className="mt-3"><RichText text={open.description} /></div>}
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            <a href={`${base}/${open.id}/ics`} className="rounded-lg border border-slate-600 px-3 py-1.5 text-slate-200 hover:border-slate-400">Add to my calendar</a>
            {data.canModerate && (
              <>
                <button onClick={() => { setEditing(toForm(open)); setOpen(null); }} className="text-slate-400 hover:text-slate-200">Edit</button>
                <button onClick={() => remove(open)} className="text-rose-400 hover:text-rose-300">Delete</button>
              </>
            )}
            <span className="flex-1" />
            {open.created_by_handle && <span className="text-xs text-slate-500">Added by @{open.created_by_handle}</span>}
          </div>
        </Modal>
      )}

      {editing && (
        <EventForm initial={editing} base={base} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

function DayList({ title, events, tasks, onOpen, empty }: { title: string; events: Ev[]; tasks: Task[]; onOpen: (e: Ev) => void; empty: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-4">
      <p className="text-sm font-semibold text-slate-200 mb-2">{title}</p>
      {events.length + tasks.length === 0 ? (
        <p className="text-xs text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {events.map(e => (
            <li key={e.id}>
              <button onClick={() => onOpen(e)} className="flex w-full items-start gap-3 text-left">
                <span className="w-14 flex-shrink-0 text-xs text-blue-300">{timeLabel(e)}</span>
                <span className="min-w-0 text-sm text-slate-100">{e.title}{e.location && <span className="block truncate text-xs text-slate-500">{e.location}</span>}</span>
              </button>
            </li>
          ))}
          {tasks.map(t => (
            <li key={t.id}>
              <a href={t.href} className="flex items-start gap-3">
                <span className="w-14 flex-shrink-0 text-xs text-amber-300">Task due</span>
                <span className="min-w-0 text-sm text-slate-100">{t.title}<span className="block truncate text-xs text-slate-500">{t.project} · {t.status}</span></span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UpcomingList({ events, tasks, onOpen }: { events: Ev[]; tasks: Task[]; onOpen: (e: Ev) => void }) {
  const todayKey = localKey(new Date());
  const groups = new Map<string, { ev: Ev[]; tk: Task[] }>();
  const add = (k: string) => { if (!groups.has(k)) groups.set(k, { ev: [], tk: [] }); return groups.get(k)!; };
  for (const e of events) { const [a, b] = eventDays(e); add(a < todayKey && b >= todayKey ? todayKey : a).ev.push(e); }
  for (const t of tasks) add(t.due_at).tk.push(t);
  const keys = [...groups.keys()].filter(k => k >= todayKey).sort();
  if (!keys.length) return <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-10 text-center text-sm text-slate-500">Nothing coming up.</div>;
  return (
    <div className="space-y-3">
      {keys.map(k => (
        <DayList key={k} events={groups.get(k)!.ev} tasks={groups.get(k)!.tk} onOpen={onOpen} empty=""
          title={new Date(k + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
      ))}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-[#0c1322] p-5 sm:max-w-lg shadow-2xl">
        {children}
      </div>
    </div>
  );
}

// ── Create / edit form ───────────────────────────────────────────────────────

type FormState = {
  id?: string; title: string; date: string; startTime: string; endDate: string; endTime: string;
  allDay: boolean; location: string; description: string;
};

function toForm(e: Ev): Partial<FormState> {
  const s = new Date(e.starts_at), en = e.ends_at ? new Date(e.ends_at) : null;
  const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return {
    id: e.id, title: e.title, allDay: e.all_day, location: e.location ?? '', description: e.description ?? '',
    date: e.all_day ? utcKey(s) : localKey(s), startTime: e.all_day ? '' : hm(s),
    endDate: en ? (e.all_day ? utcKey(en) : localKey(en)) : '', endTime: en && !e.all_day ? hm(en) : '',
  };
}

function EventForm({ initial, base, onClose, onSaved }: { initial: Partial<FormState>; base: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<FormState>({
    title: '', date: initial.date ?? localKey(new Date()), startTime: '19:00', endDate: '', endTime: '20:00',
    allDay: false, location: '', description: '', ...initial,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof FormState, v: string | boolean) => setF(p => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    // All-day: midnight UTC on the chosen dates. Timed: the viewer's local time.
    const startsAt = f.allDay ? `${f.date}T00:00:00.000Z` : new Date(`${f.date}T${f.startTime || '00:00'}`).toISOString();
    const endDate = f.endDate || f.date;
    const endsAt = f.allDay
      ? (f.endDate ? `${f.endDate}T00:00:00.000Z` : null)
      : (f.endTime ? new Date(`${endDate}T${f.endTime}`).toISOString() : null);
    setSaving(true); setError('');
    const r = await fetch(f.id ? `${base}/${f.id}` : base, {
      method: f.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: f.title, startsAt, endsAt, allDay: f.allDay, location: f.location, description: f.description }),
    });
    setSaving(false);
    if (!r.ok) { setError((await r.json()).error ?? 'Could not save'); return; }
    onSaved();
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-100">{f.id ? 'Edit event' : 'New event'}</h3>
        <input value={f.title} onChange={e => set('title', e.target.value)} required maxLength={200} placeholder="Title" className={inputCls} autoFocus />
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={f.allDay} onChange={e => set('allDay', e.target.checked)} className="accent-blue-500" /> All day
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-400">Starts
            <input type="date" value={f.date} onChange={e => set('date', e.target.value)} required className={`${inputCls} mt-1`} />
          </label>
          {!f.allDay && (
            <label className="text-xs text-slate-400">at
              <input type="time" value={f.startTime} onChange={e => set('startTime', e.target.value)} required className={`${inputCls} mt-1`} />
            </label>
          )}
          <label className="text-xs text-slate-400">Ends <span className="text-slate-600">(optional)</span>
            <input type="date" value={f.endDate} min={f.date} onChange={e => set('endDate', e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          {!f.allDay && (
            <label className="text-xs text-slate-400">at
              <input type="time" value={f.endTime} onChange={e => set('endTime', e.target.value)} className={`${inputCls} mt-1`} />
            </label>
          )}
        </div>
        <input value={f.location} onChange={e => set('location', e.target.value)} maxLength={500} placeholder="Location, or a meeting link (optional)" className={inputCls} />
        <textarea value={f.description} onChange={e => set('description', e.target.value)} rows={4} maxLength={5000} placeholder="Details (optional)" className={inputCls} />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">{saving ? 'Saving…' : 'Save event'}</button>
          <button type="button" onClick={onClose} className="px-2 text-sm text-slate-500 hover:text-slate-300">Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
