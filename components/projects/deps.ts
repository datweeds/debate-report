// Task dependencies: the date rules, shared by the browser and the server.
//
// A task depends on another task's finish ('finish': it can't start until the
// other has ended) or its start ('start': it can't start before the other has).
// Dates are 'YYYY-MM-DD', so they compare as strings.

export type DepKind = 'finish' | 'start';
export type Dep = { task_id: string; kind: DepKind };
export const DEP_KINDS: DepKind[] = ['finish', 'start'];
export const DEP_LABEL: Record<DepKind, string> = { finish: 'finishes', start: 'starts' };

type Dated = { id: string; name: string; start_date: string | null; end_date: string | null; due_date: string | null };

// When a task begins (start, or failing that its end or due date)
export const beginsOf = (t: Dated) => t.start_date ?? t.end_date ?? t.due_date;
// When a task ends (end, or failing that its due date or start)
export const endsOf = (t: Dated) => t.end_date ?? t.due_date ?? t.start_date;

// The earliest date a task may begin under one dependency (null = no date to go on)
export const earliestFor = (other: Dated, kind: DepKind) => kind === 'finish' ? endsOf(other) : beginsOf(other);

/** The dependency's problem, in words, or null if the dates agree (or aren't set). */
export function depProblem(task: Dated, other: Dated, kind: DepKind): string | null {
  const begins = beginsOf(task), earliest = earliestFor(other, kind);
  if (!begins || !earliest || begins >= earliest) return null;
  const day = new Date(`${earliest}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return `starts before “${other.name}” ${DEP_LABEL[kind]} (${day})`;
}

/** The latest date a task's dependencies allow it to start, or null. */
export function earliestStart(deps: Dep[], byId: Map<string, Dated>): string | null {
  let out: string | null = null;
  for (const d of deps) {
    const other = byId.get(d.task_id);
    const e = other ? earliestFor(other, d.kind) : null;
    if (e && (!out || e > out)) out = e;
  }
  return out;
}

/**
 * Would making `taskId` depend on `deps` create a loop? `edges` is every
 * existing dependency (task → what it depends on), excluding taskId's own.
 */
export function makesLoop(taskId: string, deps: string[], edges: Map<string, string[]>): boolean {
  const seen = new Set<string>();
  const stack = [...deps];
  while (stack.length) {
    const n = stack.pop()!;
    if (n === taskId) return true;
    if (seen.has(n)) continue;
    seen.add(n);
    stack.push(...(edges.get(n) ?? []));
  }
  return false;
}

/** A task's own ancestors and descendants: not allowed as dependencies. */
export function family(taskId: string, tasks: { id: string; parent_id: string | null }[]): Set<string> {
  const parent = new Map(tasks.map(t => [t.id, t.parent_id]));
  const out = new Set<string>([taskId]);
  for (let p = parent.get(taskId) ?? null; p; p = parent.get(p) ?? null) out.add(p);
  const children = new Map<string, string[]>();
  for (const t of tasks) if (t.parent_id) children.set(t.parent_id, [...(children.get(t.parent_id) ?? []), t.id]);
  const stack = [...(children.get(taskId) ?? [])];
  while (stack.length) { const c = stack.pop()!; out.add(c); stack.push(...(children.get(c) ?? [])); }
  return out;
}
