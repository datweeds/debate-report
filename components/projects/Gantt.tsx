'use client';

import { useMemo, useState } from 'react';
import { allIn, depProblems, depSummary, flatten, isOverdue, sections, type Task, type TaskGroup, type TreeNode } from './TaskTree';
import { depProblem } from './deps';
import { TASK_STATUS, todayKey } from './shared';

const DAY = 86400000;
const toDay = (d: string) => Math.round(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY);
const fromDay = (n: number) => new Date(n * DAY);
const ROW = 32;   // px: each row is h-8

// A bar's first and last day, or null when the task has no dates
function span(t: Task): { s: number; e: number } | null {
  const s = t.start_date ? toDay(t.start_date) : null;
  const e = t.end_date ? toDay(t.end_date) : t.due_date ? toDay(t.due_date) : null;
  const a = s ?? e, b = e ?? s;
  return a == null || b == null ? null : { s: Math.min(a, b), e: Math.max(a, b) };
}

// The chart's rows: group headers (when the project has groups) and tasks
type Row =
  | { kind: 'group'; key: string; name: string; tasks: TreeNode[]; shut: boolean }
  | { kind: 'task'; key: string; t: TreeNode; grouped: boolean };

// A simple Gantt chart: one row per task (indented by level), a bar from start
// to end, ◆ at the due date, a line for today, and an arrow from each task to
// the tasks that depend on it (red when the dates clash). Task Groups get a
// header row with a bar spanning their tasks, and collapse to just that row.
// Scrolls sideways on phones.
export default function Gantt({ tasks, groups, projectStart, projectEnd, onOpen }: {
  tasks: Task[]; groups: TaskGroup[]; projectStart: string | null; projectEnd: string | null; onOpen?: (id: string) => void;
}) {
  const [shut, setShut] = useState<Set<string>>(new Set());
  const toggle = (key: string) => setShut(s => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  // Each task's row, or its group's row when the group is collapsed
  const { rows, rowOf } = useMemo(() => {
    const rows: Row[] = [];
    const rowOf = new Map<string, number>();
    for (const sec of sections(tasks, groups)) {
      const all = allIn(sec.roots);
      if (groups.length) {
        const key = `g:${sec.group?.id ?? 'none'}`, closed = shut.has(key);
        rows.push({ kind: 'group', key, name: sec.group?.name ?? 'Ungrouped', tasks: all, shut: closed });
        if (closed) { for (const t of all) rowOf.set(t.id, rows.length - 1); continue; }
      }
      for (const t of flatten(sec.roots)) { rows.push({ kind: 'task', key: t.id, t, grouped: groups.length > 0 }); rowOf.set(t.id, rows.length - 1); }
    }
    return { rows, rowOf };
  }, [tasks, groups, shut]);
  const byId = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);

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

  if (!tasks.length) return <div className="rounded-2xl border border-slate-800 bg-dr-card p-10 text-center text-sm text-slate-500">No tasks yet.</div>;
  if (!range) return <div className="rounded-2xl border border-slate-800 bg-dr-card p-10 text-center text-sm text-slate-500">Give tasks start, end or due dates to see them on the chart.</div>;

  const width = range.span * range.px;
  const x = (day: number) => (day - range.start) * range.px;

  // Dependency arrows: from the other task's end ('finish') or start ('start')
  // to this task's start, with elbows that go round when they must
  // (a task in a collapsed group is drawn from or to its group's row)
  const arrows = tasks.flatMap(t => (t.dependencies ?? []).flatMap(d => {
    const other = byId.get(d.task_id), i = rowOf.get(t.id), j = rowOf.get(d.task_id);
    const to = span(t), from = other ? span(other) : null;
    if (!other || i == null || j == null || i === j || !to || !from) return [];
    const x1 = d.kind === 'finish' ? x(from.e) + range.px : x(from.s), y1 = j * ROW + ROW / 2;
    const x2 = x(to.s), y2 = i * ROW + ROW / 2;
    const gap = 6;
    const path = x2 - gap >= x1 + gap
      ? `M${x1},${y1} H${x1 + gap} V${y2} H${x2 - 1}`
      : `M${x1},${y1} H${x1 + gap} V${y2 + (y2 > y1 ? -ROW / 2 : ROW / 2)} H${x2 - gap} V${y2} H${x2 - 1}`;
    const bad = !!depProblem(t, other, d.kind);
    return [{ key: `${t.id}-${d.task_id}`, path, bad }];
  }));

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
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-dr-card">
      <div className="flex">
        {/* Task names (fixed) */}
        <div className="w-36 sm:w-60 flex-shrink-0 border-r border-slate-800">
          <div className="h-9 border-b border-slate-800 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Task</div>
          {rows.map(r => r.kind === 'group' ? (
            <button key={r.key} onClick={() => toggle(r.key)} title={r.shut ? `Show the tasks in ${r.name}` : `Collapse ${r.name}`}
              className="flex h-8 w-full items-center gap-1.5 border-b border-slate-800/50 bg-slate-800/40 px-3 text-left text-xs font-semibold text-slate-100 hover:bg-slate-800/70">
              <span className="w-3 text-slate-400">{r.shut ? '▸' : '▾'}</span>
              <span className="truncate">{r.name}</span>
              <span className="ml-auto flex-shrink-0 text-[10px] font-normal text-slate-500">{r.tasks.length}</span>
            </button>
          ) : (
            <button key={r.key} onClick={() => onOpen?.(r.t.id)} title={r.t.name}
              className="block h-8 w-full truncate border-b border-slate-800/50 px-3 text-left text-xs text-slate-200 hover:bg-slate-800/40"
              style={{ paddingLeft: `${0.75 + (r.t.depth + (r.grouped ? 1 : 0)) * 0.9}rem` }}>
              {r.t.name}
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
              {rows.map(r => {
                if (r.kind === 'group') {
                  // A bracket from the group's first day to its last
                  const spans = r.tasks.map(span).filter(Boolean) as { s: number; e: number }[];
                  const done = r.tasks.filter(t => t.status === 'complete').length;
                  if (!spans.length) return <div key={r.key} className="h-8 border-b border-slate-800/50 bg-slate-800/20" />;
                  const gs = Math.min(...spans.map(p => p.s)), ge = Math.max(...spans.map(p => p.e));
                  const w = (ge - gs + 1) * range.px;
                  return (
                    <div key={r.key} className="relative h-8 border-b border-slate-800/50 bg-slate-800/20">
                      <button onClick={() => toggle(r.key)} title={`${r.name}: ${done}/${r.tasks.length} complete`}
                        className="absolute top-2.5 h-3 overflow-hidden rounded-sm bg-slate-500/50 hover:brightness-125" style={{ left: x(gs), width: w }}>
                        <span className="block h-full bg-emerald-500/70" style={{ width: `${r.tasks.length ? (done / r.tasks.length) * 100 : 0}%` }} />
                      </button>
                      <span className="pointer-events-none absolute top-2 h-4 border-l-2 border-slate-300" style={{ left: x(gs) }} />
                      <span className="pointer-events-none absolute top-2 h-4 border-r-2 border-slate-300" style={{ left: x(gs) + w - 2 }} />
                    </div>
                  );
                }
                const t = r.t;
                const problems = depProblems(t, byId);
                const s = t.start_date ? toDay(t.start_date) : null;
                const e = t.end_date ? toDay(t.end_date) : t.due_date ? toDay(t.due_date) : null;
                const due = t.due_date ? toDay(t.due_date) : null;
                const barStart = s ?? e;
                const barEnd = e ?? s;
                return (
                  <div key={r.key} className="relative h-8 border-b border-slate-800/50">
                    {barStart != null && barEnd != null && (
                      <button onClick={() => onOpen?.(t.id)}
                        title={[`${t.name}: ${TASK_STATUS[t.status].label}`,
                          t.dependencies?.length ? `Starts ${depSummary(t, byId)}` : '',
                          problems.length ? `⚠ Dates clash: ${problems.join('; ')}` : ''].filter(Boolean).join('\n')}
                        className={`absolute top-2 h-4 rounded ${TASK_STATUS[t.status].bar} ${t.depth > 0 ? 'opacity-80' : ''} ${problems.length ? 'ring-2 ring-rose-500' : ''} hover:brightness-125`}
                        style={{ left: x(Math.min(barStart, barEnd)), width: Math.max(range.px, (Math.abs(barEnd - barStart) + 1) * range.px) }} />
                    )}
                    {due != null && (
                      <span className={`absolute top-1 text-sm leading-none ${isOverdue(t) ? 'text-rose-400' : 'text-amber-300'}`}
                        style={{ left: x(due) + range.px / 2 - 5 }} title={`Due ${t.due_date}`}>◆</span>
                    )}
                  </div>
                );
              })}
              {arrows.length > 0 && (
                <svg className="pointer-events-none absolute left-0 top-0 z-20" width={width} height={rows.length * ROW} aria-hidden="true">
                  <defs>
                    {['ok', 'bad'].map(k => (
                      <marker key={k} id={`gantt-arrow-${k}`} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto">
                        <path d="M0,0 L6,3 L0,6 z" className={k === 'bad' ? 'fill-rose-500' : 'fill-slate-300'} />
                      </marker>
                    ))}
                  </defs>
                  {arrows.map(a => (
                    <path key={a.key} d={a.path} fill="none" strokeWidth={1.5} strokeDasharray={a.bad ? '4 3' : undefined}
                      className={a.bad ? 'stroke-rose-500' : 'stroke-slate-300/80'} markerEnd={`url(#gantt-arrow-${a.bad ? 'bad' : 'ok'})`} />
                  ))}
                </svg>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 border-t border-slate-800 px-3 py-2 text-[11px] text-slate-400">
        {Object.values(TASK_STATUS).map(s => <span key={s.label} className="flex items-center gap-1.5"><span className={`h-2.5 w-4 rounded ${s.bar}`} />{s.label}</span>)}
        <span className="flex items-center gap-1.5"><span className="text-amber-300">◆</span>Due date</span>
        <span className="flex items-center gap-1.5"><span className="h-3 border-l-2 border-rose-500" />Today</span>
        <span className="flex items-center gap-1.5"><span className="text-slate-300">→</span>Depends on</span>
        <span className="flex items-center gap-1.5"><span className="text-rose-400">⇢</span>Dates clash</span>
        {groups.length > 0 && <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-slate-500/50"><span className="block h-full w-1/2 bg-emerald-500/70" /></span>Group (share complete)</span>}
      </div>
    </div>
  );
}
