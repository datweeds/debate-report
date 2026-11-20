// Society Projects: who may do what, and input validation. Server-only.

import type { NextRequest } from 'next/server';
import { sealedFor, SealedTextError, type SealedItem } from './sealed/server';
import pool from './db';
import { societyContentAccess, type SocietyContentAccess } from './societies';
import { openRows, sealText } from './societyCrypto';
import { DEP_KINDS, depProblem, family, makesLoop, type Dep } from '@/components/projects/deps';

export const TASK_STATUSES = ['new', 'in_progress', 'complete'] as const;
export const PROJECT_STATUSES = ['active', 'on_hold', 'complete'] as const;
export const RAID_KINDS = ['risk', 'issue', 'dependency', 'assumption'] as const;
export const LEVELS = ['low', 'medium', 'high'] as const;
export const RAID_STATUSES = ['open', 'mitigated', 'closed'] as const;
export const UUID_RE = /^[0-9a-f-]{36}$/i;

export type ProjectRow = {
  id: string; customer_id: number; name: string; description: string | null; manager_id: string | null;
  status: string; start_date: string | null; end_date: string | null; created_by: string | null;
  protection: 'server' | 'sealed'; sealed_epoch: number | null;
};

export type ProjectContext = {
  a: SocietyContentAccess;
  project: ProjectRow;
  me: string | null;
  isManager: boolean;     // this project's PM
  canManage: boolean;     // PM or Society moderator: tasks, allocation
  canContribute: boolean; // Society members: reports on their tasks, RAID items
  sealed: SealedItem | null; // sealed: its text is encrypted in members' browsers
};

// Society access + the project, or null when either isn't visible.
export async function projectContext(req: NextRequest, rawSocietyId: string, projectId: string): Promise<ProjectContext | null> {
  const a = await societyContentAccess(req, rawSocietyId);
  if (!a || !UUID_RE.test(projectId)) return null;
  const { rows: [project] } = await pool.query(
    `SELECT id, customer_id, name, description, manager_id, status, protection, sealed_epoch,
            to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date, created_by
     FROM projects WHERE id = $1 AND customer_id = $2 AND deleted_at IS NULL`,
    [projectId, a.societyId],
  );
  if (!project) return null;
  await openRows(a.societyId, [project], ['name', 'description']);
  const me = a.session?.sub ?? null;
  const isManager = !!me && project.manager_id === me;
  const sealed: SealedItem | null = project.protection === 'sealed'
    ? { type: 'project', id: project.id, societyId: a.societyId, epoch: project.sealed_epoch ?? 1 } : null;
  return { a, project, me, isManager, canManage: isManager || a.canModerate, canContribute: a.isMember, sealed };
}

export async function isSocietyMember(customerId: number, userId: string) {
  const { rows } = await pool.query(
    `SELECT 1 FROM customer_members WHERE customer_id = $1 AND user_id = $2
     UNION SELECT 1 FROM customer_roles WHERE tenant_id = $1 AND user_id = $2 AND role = 'customer_admin'`,
    [customerId, userId],
  );
  return rows.length > 0;
}

// 'YYYY-MM-DD', '' (clear) or undefined (unchanged)
export function readDate(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) ? v : undefined;
}

export function text(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}

/**
 * Text for a project: in a sealed project it must arrive sealed for the current
 * epoch (and is kept whole); elsewhere it's tidied as usual and must be plain.
 * A mismatch throws SealedTextError, which lockSafe answers with a clear 400.
 */
export function ptext(c: Pick<ProjectContext, 'sealed'>, v: unknown, max: number): string | null {
  if (v == null || (typeof v === 'string' && !v.trim())) return null;
  if (c.sealed) {
    if (sealedFor(c.sealed, v, 30000)) return v as string;
    throw new SealedTextError('This sealed project’s keys have changed: reload the page and try again');
  }
  if (typeof v === 'string' && v.startsWith('sn1:')) throw new SealedTextError('This project isn’t sealed');
  return text(v, max);
}

// A task's linked document: one of the Society's documents that hasn't been
// deleted. undefined = not given; null = clear it; false = not allowed.
export async function readDocumentId(customerId: number, v: unknown): Promise<string | null | undefined | false> {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (typeof v !== 'string' || !UUID_RE.test(v)) return false;
  const { rows } = await pool.query('SELECT 1 FROM documents WHERE id = $1 AND customer_id = $2 AND deleted_at IS NULL', [v, customerId]);
  return rows.length ? v : false;
}

// ── Dependencies ─────────────────────────────────────────────────────────────

// [{ taskId, kind }] → Dep[]; undefined = not given; false = malformed
export function readDeps(v: unknown): Dep[] | undefined | false {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.length > 50) return false;
  const out = new Map<string, Dep>();
  for (const d of v) {
    const id = d?.taskId ?? d?.task_id, kind = d?.kind ?? 'finish';
    if (typeof id !== 'string' || !UUID_RE.test(id) || !DEP_KINDS.includes(kind)) return false;
    out.set(id, { task_id: id, kind });
  }
  return [...out.values()];
}

type Dates = { start_date: string | null; end_date: string | null; due_date: string | null };

/**
 * Check a task's dependencies before saving: same project, not itself or its
 * own parent or sub-tasks, no loops, and dates that agree. `taskId` is null
 * for a new task (`parentId` its parent). Returns the problem, or null.
 */
export async function checkDeps(projectId: string, taskId: string | null, parentId: string | null, name: string,
  deps: Dep[], dates: Dates): Promise<string | null> {
  if (!deps.length) return null;
  const { rows: tasks } = await pool.query(
    `SELECT id, parent_id, name, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date,
            to_char(due_date, 'YYYY-MM-DD') AS due_date
     FROM project_tasks WHERE project_id = $1`, [projectId]);
  const byId = new Map(tasks.map(t => [t.id as string, t]));
  const self = taskId ?? 'new';
  const fam = family(self, [...tasks, ...(taskId ? [] : [{ id: 'new', parent_id: parentId }])]);
  for (const d of deps) {
    if (!byId.has(d.task_id)) return 'A task it depends on was not found in this project';
    if (fam.has(d.task_id)) return 'A task can’t depend on itself, its parent task or its own sub-tasks';
  }
  if (taskId) {
    const { rows: edgesRows } = await pool.query(
      `SELECT d.task_id, d.depends_on FROM project_task_deps d JOIN project_tasks t ON t.id = d.task_id
       WHERE t.project_id = $1 AND d.task_id <> $2`, [projectId, taskId]);
    const edges = new Map<string, string[]>();
    for (const e of edgesRows) edges.set(e.task_id, [...(edges.get(e.task_id) ?? []), e.depends_on]);
    if (makesLoop(taskId, deps.map(d => d.task_id), edges)) return 'Those dependencies would go round in a loop';
  }
  // Names are encrypted in private Societies: only open the ones a message needs
  for (const d of deps) {
    const other = byId.get(d.task_id)!;
    if (depProblem({ id: self, name, ...dates }, other, d.kind)) {
      const [named] = await openRows(await societyOfProject(projectId), [{ ...other }], ['name']);
      // A sealed project's names can't be read here: say it without them
      const sealedNames = name.startsWith('sn1:') || String(named.name).startsWith('sn1:');
      const shown = sealedNames ? { ...named, name: 'another task' } : named;
      return `${sealedNames ? 'This task' : `“${name}”`} ${depProblem({ id: self, name, ...dates }, shown, d.kind)}. Move its start date, or change the dependency.`;
    }
  }
  return null;
}

async function societyOfProject(projectId: string): Promise<number> {
  const { rows: [p] } = await pool.query('SELECT customer_id FROM projects WHERE id = $1', [projectId]);
  return p.customer_id;
}

/** Replace a task's dependencies. */
export async function saveDeps(taskId: string, deps: Dep[]) {
  await pool.query('DELETE FROM project_task_deps WHERE task_id = $1', [taskId]);
  for (const d of deps) {
    await pool.query('INSERT INTO project_task_deps (task_id, depends_on, kind) VALUES ($1, $2, $3)', [taskId, d.task_id, d.kind]);
  }
}

// ── Task Groups ──────────────────────────────────────────────────────────────

/**
 * The group a task is put in: an existing group (groupId), a new one (newGroup:
 * its name, created here), or none (groupId null / ''). undefined = unchanged.
 */
export async function readGroup(projectId: string, customerId: number, userId: string | null, b: { groupId?: unknown; newGroup?: unknown },
  c?: Pick<ProjectContext, 'sealed'>): Promise<{ id: string | null } | { error: string } | undefined> {
  const fresh = c ? ptext(c, b.newGroup, 120) : text(b.newGroup, 120);
  if (fresh) {
    const { rows: [g] } = await pool.query(
      `INSERT INTO project_task_groups (project_id, name, sort_order, created_by)
       VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM project_task_groups WHERE project_id = $1), $3) RETURNING id`,
      [projectId, await sealText(customerId, fresh), userId]);
    return { id: g.id };
  }
  if (b.groupId === undefined) return undefined;
  if (b.groupId === null || b.groupId === '') return { id: null };
  if (typeof b.groupId !== 'string' || !UUID_RE.test(b.groupId)) return { error: 'That group was not found' };
  const { rows } = await pool.query('SELECT 1 FROM project_task_groups WHERE id = $1 AND project_id = $2', [b.groupId, projectId]);
  return rows.length ? { id: b.groupId } : { error: 'That group was not found' };
}
