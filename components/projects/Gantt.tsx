'use client';

import { useMemo } from 'react';
import { buildTree, flatten, isOverdue, type Task } from './TaskTree';
import { TASK_STATUS, todayKey } from './shared';

const DAY = 86400000;
const toDay = (d: string) => Math.round(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY);
const fromDay = (n: number) => new Date(n * DAY);

// A simple Gantt chart: one row per task (indented by level), a bar from start
// to end, ◆ at the due date, and a line for today. Scrolls sideways on phones.
export default function Gantt({ tasks, projectStart, projectEnd, onOpen }: {
  tasks: Task[]; projectStart: string | null; projectEnd: string | null; onOpen?: (id: string) => void;
}) {
  const rows = useMemo(() => flatten(buildTree(tasks)), [tasks]);

  const range = useMemo(() => {
    const days: number[] = [];
    for (const t of tasks) for (const d of [t.start_date, t.end_date, t.due_date]) if (d) days.push(toDay(d));
    for (const d of [projectStart, projectEnd]) if (d) days.push(toDay(d));
    if (!days.length) return null;
    const today = toDay(todayKey());
    const start = Math.min(...days) - 3, end = Math.max(...days, Math.min(today, Math.max(...days) + 14)) + 3;
    const span = end - start + 1;
    // Wider days for short projects, narrower for long ones
    const px = span <= 45 ? 26 : span <= 120 ? 12 : span <= 365 ? 5 : 2.5;
    return { start, end, span, px, today };
  }, [tasks, projectStart, projectEnd]);

  if (!tasks.length) return <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-10 text-center text-sm text-slate-500">No tasks yet.</div>;
  if (!range) return <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-10 text-center text-sm text-slate-500">Give tasks start, end or due dates to see them on the chart.</div>;

  const width = range.span * range.px;
  const x = (day: number) => (day - range.start) * range.px;

  // Month labels across the top, and a tick at each month / week start
  const months: { left: number; label: string }[] = [];
  const weeks: number[] = [];
  for (let d = range.start; d <= range.end; d++) {
    const date = fromDay(d);
    // Label each month; label the partial first month only if there's room before the next
    const daysLeftInMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).getTime() / DAY - d;
    if (date.getUTCDate() === 1 || (d === range.start && daysLeftInMonth * range.px >= 70)) {
      months.push({ left: x(d), label: date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }) });
    }
    if (date.getUTCDay() === 1 && range.px >= 5) weeks.push(x(d));
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0c1322]">
      <div className="flex">
        {/* Task names (fixed) */}
        <div className="w-36 sm:w-60 flex-shrink-0 border-r border-slate-800">
          <div className="h-9 border-b border-slate-800 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Task</div>
          {rows.map(t => (
            <button key={t.id} onClick={() => onOpen?.(t.id)} title={t.name}
              className="block h-8 w-full truncate border-b border-slate-800/50 px-3 text-left text-xs text-slate-200 hover:bg-slate-800/40"
              style={{ paddingLeft: `${0.75 + t.depth * 0.9}rem` }}>
              {t.name}
            </button>
          ))}
        </div>
        {/* Timeline (scrolls) */}
        <div className="flex-1 overflow-x-auto">
          <div className="relative" style={{ width }}>
            <div className="relative h-9 border-b border-slate-800">
              {months.map(m => <span key={m.left} className="absolute top-2 whitespace-nowrap pl-1 text-[11px] text-slate-400" style={{ left: m.left }}>{m.label}</span>)}
            </div>
            <div className="relative">
              {weeks.map(w => <div key={w} className="absolute top-0 bottom-0 border-l border-slate-800/60" style={{ left: w }} />)}
              {months.map(m => <div key={`m${m.left}`} className="absolute top-0 bottom-0 border-l border-slate-700" style={{ left: m.left }} />)}
              {range.today >= range.start && range.today <= range.end && (
                <div className="absolute top-0 bottom-0 z-10 border-l-2 border-rose-500/70" style={{ left: x(range.today) }} title="Today" />
              )}
              {rows.map(t => {
                const s = t.start_date ? toDay(t.start_date) : null;
                const e = t.end_date ? toDay(t.end_date) : t.due_date ? toDay(t.due_date) : null;
                const due = t.due_date ? toDay(t.due_date) : null;
                const barStart = s ?? e;
                const barEnd = e ?? s;
                return (
                  <div key={t.id} className="relative h-8 border-b border-slate-800/50">
                    {barStart != null && barEnd != null && (
                      <button onClick={() => onOpen?.(t.id)}
                        title={`${t.name}: ${TASK_STATUS[t.status].label}`}
                        className={`absolute top-2 h-4 rounded ${TASK_STATUS[t.status].bar} ${t.depth > 0 ? 'opacity-80' : ''} hover:brightness-125`}
                        style={{ left: x(Math.min(barStart, barEnd)), width: Math.max(range.px, (Math.abs(barEnd - barStart) + 1) * range.px) }} />
                    )}
                    {due != null && (
                      <span className={`absolute top-1 text-sm leading-none ${isOverdue(t) ? 'text-rose-400' : 'text-amber-300'}`}
                        style={{ left: x(due) + range.px / 2 - 5 }} title={`Due ${t.due_date}`}>◆</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 border-t border-slate-800 px-3 py-2 text-[11px] text-slate-400">
        {Object.values(TASK_STATUS).map(s => <span key={s.label} className="flex items-center gap-1.5"><span className={`h-2.5 w-4 rounded ${s.bar}`} />{s.label}</span>)}
        <span className="flex items-center gap-1.5"><span className="text-amber-300">◆</span>Due date</span>
        <span className="flex items-center gap-1.5"><span className="h-3 border-l-2 border-rose-500" />Today</span>
      </div>
    </div>
  );
}
