'use client';

import { describe, occurrences, type Freq, type Rule } from '@/lib/recurrence';
import ReportButton from '@/components/ReportButton';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import RefButton, { insertAtCursor } from '@/components/refs/RefButton';
import { resolveRef } from '@/components/refs/resolve';
import RichText from '@/components/discussions/RichText';
import SecureAccessDialog from '@/components/sealed/SecureAccessDialog';
import { useSecureAccess } from '@/components/sealed/useSecureAccess';
import { keysFor, newItemKeys, openItemText, sealItemText, sealItemTextOrNull, societyMembers, type ItemKeys } from '@/components/sealed/items';
import { toIcs, type Responses, type ResponseVisibility } from '@/lib/events';
import EventResponses from './EventResponses';
import CalendarTaskPreview from './CalendarTaskPreview';

type Ev = {
  id: string; title: string; description: string | null; location: string | null;
  starts_at: string; ends_at: string | null; all_day: boolean; created_by_handle: string | null;
  response_visibility: ResponseVisibility; responses: Responses | null;
  series_id: string | null; series_rule: Rule | null;
};
// A project task on its due date ('YYYY-MM-DD', a calendar date with no time zone).
type Task = { id: string; kind?: 'project' | 'task'; title: string; project: string; due_at: string; status: string; done?: boolean; href: string };

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
  const [showTasks, setShowTasks] = useState(true);            // your own (and shared) tasks
  const [showProjectTasks, setShowProjectTasks] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);   // completed tasks stay out unless asked for
  const [data, setData] = useState<{ events: Ev[]; tasks: Task[]; canModerate: boolean; sealed: { id: string; epoch: number } | null; canSeal: boolean } | null>(null);
  // A sealed calendar: its text is opened and sealed here, with this person's keys
  const societyBase = `/api/societies/${societyId}`;
  const access = useSecureAccess();
  const [keys, setKeys] = useState<ItemKeys | null>(null);
  const [keyError, setKeyError] = useState(false);
  const [dialog, setDialog] = useState<'setup' | 'unlock' | null>(null);
  const [busy, setBusy] = useState('');
  const [selectedDay, setSelectedDay] = useState(localKey(today));
  const [open, setOpen] = useState<Ev | null>(null);
  const [taskOpen, setTaskOpen] = useState<Task | null>(null);   // a task's preview
  const [editing, setEditing] = useState<Partial<FormState> | null>(null);
  const [error, setError] = useState('');
  const [askDelete, setAskDelete] = useState(false);   // a series: which events to delete

  const grid = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);

  const load = useCallback(async () => {
    const from = view === 'month' ? grid[0] : new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const to = view === 'month' ? new Date(grid[41].getTime() + 86400000) : new Date(from.getTime() + 120 * 86400000);
    const r = await fetch(`${base}?from=${from.toISOString()}&to=${to.toISOString()}`);
    if (r.ok) setData(await r.json()); else setError('Could not load the calendar.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, grid, view]);
  useEffect(() => { load(); }, [load]);

  const sealedId = data?.sealed?.id ?? null;
  useEffect(() => {
    if (!sealedId || access.status !== 'ready' || !access.identity || keys?.id === sealedId) return;
    keysFor(societyBase, 'calendar', sealedId, access.identity).then(setKeys).catch(() => setKeyError(true));
  }, [sealedId, access.status, access.identity, keys?.id, societyBase]);

  // Events as people read them: sealed text opened, or a placeholder without a key
  const opened = useMemo(() => (data?.events ?? []).map(e => !sealedId ? e : {
    ...e,
    title: openItemText(keys, e.title) ?? 'Sealed event',
    description: openItemText(keys, e.description),
    location: openItemText(keys, e.location),
  }), [data?.events, sealedId, keys]);

  // ?event=<id> (a reference, or a preview's "Open in Calendar"): go to its day and open it
  const eventParam = useSearchParams().get('event');
  const jumped = useRef<string | null>(null);
  const toOpen = useRef<string | null>(null);
  useEffect(() => {
    if (!eventParam || jumped.current === eventParam) return;
    jumped.current = eventParam;
    resolveRef({ society: societyId, kind: 'event', id: eventParam }).then(v => {
      if (!v?.starts_at) { setError('That event has been deleted, or you don’t have access to it.'); return; }
      const k = v.all_day ? utcKey(new Date(v.starts_at)) : localKey(new Date(v.starts_at));
      toOpen.current = v.id;
      setView('month'); setShowEvents(true);
      setCursor({ y: Number(k.slice(0, 4)), m: Number(k.slice(5, 7)) - 1 });
      setSelectedDay(k);
    }).catch(() => {});
  }, [eventParam, societyId]);
  useEffect(() => {
    const e = toOpen.current && opened.find(x => x.id === toOpen.current);
    if (e) { toOpen.current = null; setOpen(e); }
  }, [opened]);

  const events = showEvents ? opened : [];
  const tasks = (data?.tasks ?? []).filter(t => (t.kind === 'task' ? showTasks : showProjectTasks) && (showCompleted || !t.done));
  const dayItems = (key: string) => ({
    ev: events.filter(e => onDay(e, key)),
    tk: tasks.filter(t => t.due_at === key),
  });

  function move(delta: number) {
    setCursor(c => { const d = new Date(c.y, c.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  }

  async function remove(e: Ev, scope?: 'one' | 'following' | 'all') {
    if (!scope && !confirm(`Delete "${e.title}"?`)) return;
    await fetch(`${base}/${e.id}${scope && scope !== 'one' ? `?scope=${scope}` : ''}`, { method: 'DELETE' });
    setOpen(null); setAskDelete(false); load();
  }

  // Seal (or unseal) the whole calendar: this browser re-encrypts every event
  async function allEvents(): Promise<Ev[]> {
    const r = await fetch(`${base}?from=1970-01-01T00:00:00Z&to=2200-01-01T00:00:00Z`);
    if (!r.ok) throw new Error('Couldn’t load the events');
    return (await r.json()).events;
  }
  async function sealCalendar() {
    if (!confirm('Seal this calendar? Every event’s title, place and details will be encrypted in members’ browsers, so only members can read them, not new.vote. Dates and times stay visible. Members need secure access to read it, and Sys Admin emergency access won’t reach it.')) return;
    if (access.status !== 'ready') { setDialog(access.status === 'locked' ? 'unlock' : 'setup'); return; }
    setBusy('Sealing…'); setError('');
    try {
      const [all, { members }] = await Promise.all([allEvents(), societyMembers(societyBase)]);
      const itemId = crypto.randomUUID();
      const { keys: k, locks } = newItemKeys('calendar', itemId, members);
      const r = await fetch(`${base}/seal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seal', itemId, locks, events: all.map(e => ({
          id: e.id, title: sealItemText(k, e.title), description: sealItemTextOrNull(k, e.description), location: sealItemTextOrNull(k, e.location),
        })) }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Couldn’t seal the calendar');
      setKeys(k); await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  }
  async function unsealCalendar() {
    if (!keys) return;
    if (!confirm('Unseal this calendar? Events go back to being encrypted on the server with the Society’s key, so AI, scanning and Sys Admin emergency access can reach them again.')) return;
    setBusy('Unsealing…'); setError('');
    try {
      const all = await allEvents();
      const plain = all.map(e => ({ id: e.id, title: openItemText(keys, e.title), description: openItemText(keys, e.description), location: openItemText(keys, e.location) }));
      if (plain.some(e => e.title == null)) throw new Error('Some events can’t be opened with your keys, so the calendar can’t be unsealed from here');
      const r = await fetch(`${base}/seal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unseal', events: plain }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Couldn’t unseal the calendar');
      setKeys(null); await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  }
  // "Add to my calendar" for a sealed event: the file is made here, from the opened text
  function downloadIcs(e: Ev) {
    const body = toIcs({ ...e, starts_at: new Date(e.starts_at), ends_at: e.ends_at ? new Date(e.ends_at) : null }, 'new.vote', `${window.location.origin}/society/${societyId}/events`);
    const url = URL.createObjectURL(new Blob([body], { type: 'text/calendar' }));
    const link = document.createElement('a');
    link.href = url; link.download = `${e.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'event'}.ics`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const canWrite = !sealedId || !!keys?.keys.has(keys.epoch);
  const seal = sealedId && keys ? (v: string) => (v ? sealItemText(keys, v) : v) : undefined;

  // Still fetching a sealed calendar's keys: hold the placeholder, rather than draw it locked first
  const keysPending = !!sealedId && !keys && !keyError && (access.status === 'loading' || access.status === 'ready');
  if (!data || keysPending) return error ? <p className="text-sm text-rose-400">{error}</p> : <div className="h-96 rounded-2xl bg-slate-800/40 animate-pulse" />;

  const monthName = new Date(cursor.y, cursor.m, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const sel = dayItems(selectedDay);

  return (
    <div className="space-y-4">
      {dialog && <SecureAccessDialog mode={dialog} onDone={() => setDialog(null)} onClose={() => setDialog(null)} />}
      {sealedId && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs text-slate-300">
          <span className="font-semibold text-emerald-300">🔐 Sealed calendar:</span> events’ titles, places and details are end-to-end encrypted, so only
          members can read them, not new.vote. Dates and times are visible. No AI, abuse scanning or Sys Admin emergency access.
          {access.status === 'none' && <> <button onClick={() => setDialog('setup')} className="font-semibold text-blue-300 hover:underline">Set up secure access</button> to read it.</>}
          {access.status === 'locked' && <> <button onClick={() => setDialog('unlock')} className="font-semibold text-blue-300 hover:underline">Unlock secure access</button> on this device to read it.</>}
          {access.status === 'ready' && keys && !keys.keys.size && <span className="text-amber-200"> Waiting for access: another member’s browser shares the key next time they open the calendar.</span>}
          {data.canModerate && keys?.keys.size ? <> <button onClick={unsealCalendar} disabled={!!busy} className="text-slate-400 hover:text-slate-200 hover:underline">Unseal</button></> : null}
        </div>
      )}
      {error && <p className="text-xs text-rose-400">{error}</p>}
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
        <label className="flex items-center gap-1.5 text-xs text-slate-400" title="Your tasks, and tasks shared with you, on their due dates">
          <input type="checkbox" checked={showTasks} onChange={e => setShowTasks(e.target.checked)} className="accent-violet-500" /> Tasks
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-400" title="Project tasks on their due dates">
          <input type="checkbox" checked={showProjectTasks} onChange={e => setShowProjectTasks(e.target.checked)} className="accent-amber-500" /> Project tasks
        </label>
        <label className={`flex items-center gap-1.5 text-xs ${showTasks || showProjectTasks ? 'text-slate-400' : 'text-slate-600'}`} title="Include tasks and project tasks that are already complete">
          <input type="checkbox" checked={showCompleted} disabled={!showTasks && !showProjectTasks} onChange={e => setShowCompleted(e.target.checked)} className="accent-emerald-500" /> Completed
        </label>
        <div className="flex overflow-hidden rounded-lg border border-slate-700 text-xs">
          {(['month', 'list'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 ${view === v ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}>
              {v === 'month' ? 'Month' : 'List'}
            </button>
          ))}
        </div>
        {data.canSeal && !sealedId && (
          <button onClick={sealCalendar} disabled={!!busy} title="End-to-end encrypt this calendar’s events" className="rounded-lg border border-emerald-600/50 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50">
            {busy || '🔐 Seal calendar'}
          </button>
        )}
        {data.canModerate && canWrite && (
          <button onClick={() => setEditing({ date: selectedDay })} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500">+ Add event</button>
        )}
      </div>

      {view === 'month' ? (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-dr-card">
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
                    onDoubleClick={() => data.canModerate && canWrite && setEditing({ date: key })}
                    className={`min-h-[3.25rem] sm:min-h-[6.5rem] cursor-pointer border-b border-r border-slate-800/70 p-1 sm:p-1.5 transition-colors ${
                      selectedDay === key ? 'bg-blue-500/10' : 'hover:bg-slate-800/30'} ${inMonth ? '' : 'opacity-40'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${isToday ? 'bg-blue-600 font-bold text-white' : 'text-slate-300'}`}>{d.getDate()}</span>
                    </div>
                    {/* Phones: dots */}
                    {count > 0 && (
                      <div className="mt-1 flex justify-center gap-0.5 sm:hidden">
                        {ev.slice(0, 3).map(e => <span key={e.id} className="h-1.5 w-1.5 rounded-full bg-blue-400" />)}
                        {tk.slice(0, 2).map(t => <span key={t.id} className={`h-1.5 w-1.5 rounded-full ${t.kind === 'task' ? 'bg-violet-400' : 'bg-amber-400'}`} />)}
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
                        <a key={t.id} href={t.href} onClick={e2 => { e2.stopPropagation(); if (plainClick(e2)) { e2.preventDefault(); setTaskOpen(t); } }}
                          className={`block truncate rounded px-1.5 py-0.5 text-[11px] ${t.kind === 'task' ? 'bg-violet-500/15 text-violet-100 hover:bg-violet-500/25' : 'bg-amber-500/15 text-amber-100 hover:bg-amber-500/25'}${t.done ? ' line-through opacity-60' : ''}`}>
                          {t.kind === 'task' ? '☑' : '◆'} {t.title}
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
            events={sel.ev} tasks={sel.tk} onOpen={setOpen} onTask={setTaskOpen}
            empty={data.canModerate ? 'Nothing on this day. Double-click a day, or use “Add event”.' : 'Nothing on this day.'}
          />
        </>
      ) : (
        <UpcomingList events={events} tasks={tasks} onOpen={setOpen} onTask={setTaskOpen} />
      )}

      {open && (
        <Modal onClose={() => { setOpen(null); setAskDelete(false); }}>
          <h3 className="text-lg font-semibold text-slate-100">{open.title}</h3>
          <p className="mt-1 text-sm text-blue-300">{rangeLabel(open)}</p>
          {open.series_rule && <p className="mt-1 text-xs text-slate-400">↻ {describe(open.series_rule, new Date(open.starts_at), open.all_day)}</p>}
          {open.location && <div className="mt-3 flex gap-2 text-sm text-slate-300"><span aria-hidden>📍</span><RichText text={open.location} /></div>}
          {open.description && <div className="mt-3"><RichText text={open.description} /></div>}
          {open.responses && <EventResponses key={open.id} url={`${base}/${open.id}/response`} initial={open.responses} onChanged={() => void load()} />}
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            {sealedId
              ? <button onClick={() => downloadIcs(open)} className="rounded-lg border border-slate-600 px-3 py-1.5 text-slate-200 hover:border-slate-400">Add to my calendar</button>
              : <a href={`${base}/${open.id}/ics`} className="rounded-lg border border-slate-600 px-3 py-1.5 text-slate-200 hover:border-slate-400">Add to my calendar</a>}
            {data.canModerate && canWrite && (
              <>
                <button onClick={() => { setEditing(toForm(open)); setOpen(null); }} className="text-slate-400 hover:text-slate-200">Edit</button>
                {open.series_id && askDelete ? (
                  <span className="flex flex-wrap items-center gap-2 text-xs text-slate-400">Delete:
                    <button onClick={() => remove(open, 'one')} className="rounded border border-rose-500/40 px-2 py-1 text-rose-300 hover:bg-rose-500/10">this event</button>
                    <button onClick={() => remove(open, 'following')} className="rounded border border-rose-500/40 px-2 py-1 text-rose-300 hover:bg-rose-500/10">this and following</button>
                    <button onClick={() => remove(open, 'all')} className="rounded border border-rose-500/40 px-2 py-1 text-rose-300 hover:bg-rose-500/10">the whole series</button>
                  </span>
                ) : (
                  <button onClick={() => (open.series_id ? setAskDelete(true) : remove(open))} className="text-rose-400 hover:text-rose-300">Delete</button>
                )}
              </>
            )}
            <ReportButton kind="event" id={open.id} what="this event" sealed={!!sealedId}
              shown={() => [open.title, open.description, open.location].filter(Boolean).join('\n')} />
            <span className="flex-1" />
            {open.created_by_handle && <span className="text-xs text-slate-500">Added by @{open.created_by_handle}</span>}
          </div>
        </Modal>
      )}

      {taskOpen && (
        <CalendarTaskPreview key={taskOpen.id} society={societyId} kind={taskOpen.kind === 'task' ? 'task' : 'project'} id={taskOpen.id} onClose={() => setTaskOpen(null)} />
      )}

      {editing && (
        <EventForm society={societyId} initial={editing} base={base} seal={seal} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

// A plain click opens a preview; Ctrl/⌘/Shift-click or middle-click still follow the link
const plainClick = (e: React.MouseEvent) => e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey;

function DayList({ title, events, tasks, onOpen, onTask, empty }: { title: string; events: Ev[]; tasks: Task[]; onOpen: (e: Ev) => void; onTask: (t: Task) => void; empty: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-dr-card p-4">
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
              <a href={t.href} onClick={e => { if (plainClick(e)) { e.preventDefault(); onTask(t); } }} className="flex items-start gap-3">
                <span className={`w-14 flex-shrink-0 text-xs ${t.kind === 'task' ? 'text-violet-300' : 'text-amber-300'}`}>{t.kind === 'task' ? '☑ Due' : '◆ Due'}</span>
                <span className={`min-w-0 text-sm ${t.done ? 'text-slate-400' : 'text-slate-100'}`}><span className={t.done ? 'line-through' : ''}>{t.title}</span><span className="block truncate text-xs text-slate-500">{t.project} · {t.status}</span></span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UpcomingList({ events, tasks, onOpen, onTask }: { events: Ev[]; tasks: Task[]; onOpen: (e: Ev) => void; onTask: (t: Task) => void }) {
  const todayKey = localKey(new Date());
  const groups = new Map<string, { ev: Ev[]; tk: Task[] }>();
  const add = (k: string) => { if (!groups.has(k)) groups.set(k, { ev: [], tk: [] }); return groups.get(k)!; };
  for (const e of events) { const [a, b] = eventDays(e); add(a < todayKey && b >= todayKey ? todayKey : a).ev.push(e); }
  for (const t of tasks) add(t.due_at).tk.push(t);
  const keys = [...groups.keys()].filter(k => k >= todayKey).sort();
  if (!keys.length) return <div className="rounded-2xl border border-slate-800 bg-dr-card p-10 text-center text-sm text-slate-500">Nothing coming up.</div>;
  return (
    <div className="space-y-3">
      {keys.map(k => (
        <DayList key={k} events={groups.get(k)!.ev} tasks={groups.get(k)!.tk} onOpen={onOpen} onTask={onTask} empty=""
          title={new Date(k + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
      ))}
    </div>
  );
}

// Viewing closes on a click outside; edit/create forms (keepOpen) close only via their own buttons
function Modal({ children, onClose, keepOpen = false }: { children: React.ReactNode; onClose: () => void; keepOpen?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4" onClick={keepOpen ? undefined : onClose}>
      <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-dr-card p-5 sm:max-w-lg shadow-2xl">
        {children}
      </div>
    </div>
  );
}

// ── Create / edit form ───────────────────────────────────────────────────────

type Repeat = '' | 'daily' | 'weekly' | 'fortnightly' | 'monthly_date' | 'monthly_weekday';
type FormState = {
  id?: string; title: string; date: string; startTime: string; endDate: string; endTime: string;
  allDay: boolean; location: string; description: string; responseVisibility: ResponseVisibility;
  seriesId?: string | null; scope: 'one' | 'following' | 'all'; repeat: Repeat; until: string;
};
const plusMonths = (key: string, n: number) => { const d = new Date(`${key}T12:00:00`); d.setMonth(d.getMonth() + n); return localKey(d); };

function toForm(e: Ev): Partial<FormState> {
  const s = new Date(e.starts_at), en = e.ends_at ? new Date(e.ends_at) : null;
  const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return {
    id: e.id, title: e.title, allDay: e.all_day, location: e.location ?? '', description: e.description ?? '', responseVisibility: e.response_visibility,
    seriesId: e.series_id, scope: 'one',
    date: e.all_day ? utcKey(s) : localKey(s), startTime: e.all_day ? '' : hm(s),
    endDate: en ? (e.all_day ? utcKey(en) : localKey(en)) : '', endTime: en && !e.all_day ? hm(en) : '',
  };
}

function EventForm({ society, initial, base, seal, onClose, onSaved }: {
  society: number; initial: Partial<FormState>; base: string; seal?: (v: string) => string; onClose: () => void; onSaved: () => void;
}) {
  // A sealed calendar: the text is encrypted here before it's sent
  const out = (v: string) => (seal ? seal(v.trim()) : v);
  const [f, setF] = useState<FormState>({
    title: '', date: initial.date ?? localKey(new Date()), startTime: '19:00', endDate: '', endTime: '20:00',
    allDay: false, location: '', description: '', responseVisibility: 'counts', scope: 'one', repeat: '',
    until: plusMonths(initial.date ?? localKey(new Date()), 3), ...initial,
  });
  const startDate = useRef(initial.date);
  // A repeating event's dates, worked out here in this browser's time zone
  const times = () => {
    const startsAt = f.allDay ? `${f.date}T00:00:00.000Z` : new Date(`${f.date}T${f.startTime || '00:00'}`).toISOString();
    const endDate = f.endDate || f.date;
    const endsAt = f.allDay
      ? (f.endDate ? `${f.endDate}T00:00:00.000Z` : null)
      : (f.endTime ? new Date(`${endDate}T${f.endTime}`).toISOString() : null);
    return { startsAt, endsAt };
  };
  const rule: Rule | null = f.repeat ? { freq: (f.repeat === 'fortnightly' ? 'weekly' : f.repeat) as Freq, interval: f.repeat === 'fortnightly' ? 2 : 1, until: f.until } : null;
  const series = useMemo(() => {
    if (!rule || !f.date) return [];
    try { const t = times(); return occurrences(new Date(t.startsAt), t.endsAt ? new Date(t.endsAt) : null, f.allDay, rule); } catch { return []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.repeat, f.until, f.date, f.startTime, f.endDate, f.endTime, f.allDay]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof FormState, v: string | boolean) => setF(p => ({ ...p, [k]: v }));
  const details = useRef<HTMLTextAreaElement>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    // All-day: midnight UTC on the chosen dates. Timed: the viewer's local time.
    const { startsAt, endsAt } = times();
    if (f.id && f.seriesId && f.scope !== 'one' && f.date !== startDate.current) {
      setError('Several events can change their time of day, but not their date. Choose “This event” to move it to another day.'); return;
    }
    if (rule && series.length < 2) { setError('Choose an end date for the repeats after the first event.'); return; }
    setSaving(true); setError('');
    const r = await fetch(f.id ? `${base}/${f.id}` : base, {
      method: f.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: out(f.title), startsAt, endsAt, allDay: f.allDay, location: out(f.location), description: out(f.description), responseVisibility: f.responseVisibility,
        ...(f.id ? { scope: f.scope } : rule ? { repeat: rule, occurrences: series } : {}),
      }),
    });
    setSaving(false);
    if (!r.ok) { setError((await r.json()).error ?? 'Could not save'); return; }
    onSaved();
  }

  return (
    <Modal onClose={onClose} keepOpen>
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
        {!f.id && (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-400">Repeats
              <select value={f.repeat} onChange={e => set('repeat', e.target.value)} className={`${inputCls} mt-1`}>
                <option value="">Doesn’t repeat</option>
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
                <option value="fortnightly">Every 2 weeks</option>
                <option value="monthly_date">Every month, same date</option>
                <option value="monthly_weekday">Every month, same weekday</option>
              </select>
            </label>
            {f.repeat && (
              <label className="text-xs text-slate-400">until
                <input type="date" value={f.until} min={f.date} onChange={e => set('until', e.target.value)} required className={`${inputCls} mt-1`} />
              </label>
            )}
            {rule && f.date && (
              <p className="col-span-2 text-xs text-slate-500">
                {series.length > 1
                  ? <>↻ {describe(rule, new Date(times().startsAt), f.allDay)}: {series.length} events{series.length >= 104 ? ' (the most a series can have)' : ''}.</>
                  : 'Choose an end date after the first event.'}
              </p>
            )}
          </div>
        )}
        {f.id && f.seriesId && (
          <fieldset className="rounded-lg border border-slate-700 p-2 text-xs text-slate-300">
            <legend className="px-1 text-slate-400">This event repeats. Save changes to</legend>
            <div className="flex flex-wrap gap-3">
              {([['one', 'This event'], ['following', 'This and following'], ['all', 'All events in the series']] as const).map(([v, l]) => (
                <label key={v} className="flex items-center gap-1.5"><input type="radio" name="scope" checked={f.scope === v} onChange={() => set('scope', v)} className="accent-blue-500" />{l}</label>
              ))}
            </div>
            {f.scope !== 'one' && <p className="mt-1 text-slate-500">Text, time of day and length change for each event; their dates stay the same.</p>}
          </fieldset>
        )}
        <input value={f.location} onChange={e => set('location', e.target.value)} maxLength={500} placeholder="Location, or a meeting link (optional)" className={inputCls} />
        <div>
          <textarea ref={details} value={f.description} onChange={e => set('description', e.target.value)} rows={4} maxLength={5000} placeholder="Details (optional)" className={inputCls} />
          <div className="flex justify-end">
            <RefButton society={society} className="rounded px-2 py-0.5 text-xs text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
              onPick={p => insertAtCursor(details.current, f.description, v => set('description', v), p.url)} />
          </div>
        </div>
        <label className="block text-xs text-slate-400">Members’ responses (“Planning to attend” / “Not coming”)
          <select value={f.responseVisibility} onChange={e => set('responseVisibility', e.target.value)} className={`${inputCls} mt-1`}>
            <option value="all">Everyone can see who’s responded</option>
            <option value="counts">Members see just the numbers</option>
            <option value="author">Only the event’s author and Society Admins see responses</option>
            <option value="off">Don’t ask for responses</option>
          </select></label>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">{saving ? 'Saving…' : 'Save event'}</button>
          <button type="button" onClick={onClose} className="px-2 text-sm text-slate-500 hover:text-slate-300">Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
