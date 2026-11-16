// Society Projects: who may do what, and input validation. Server-only.

import type { NextRequest } from 'next/server';
import pool from './db';
import { societyContentAccess, type SocietyContentAccess } from './societies';
import { openRows } from './societyCrypto';

export const TASK_STATUSES = ['new', 'in_progress', 'complete'] as const;
export const PROJECT_STATUSES = ['active', 'on_hold', 'complete'] as const;
export const RAID_KINDS = ['risk', 'issue', 'dependency', 'assumption'] as const;
export const LEVELS = ['low', 'medium', 'high'] as const;
export const RAID_STATUSES = ['open', 'mitigated', 'closed'] as const;
export const UUID_RE = /^[0-9a-f-]{36}$/i;

export type ProjectRow = {
  id: string; customer_id: number; name: string; description: string | null; manager_id: string | null;
  status: string; start_date: string | null; end_date: string | null; created_by: string | null;
};

export type ProjectContext = {
  a: SocietyContentAccess;
  project: ProjectRow;
  me: string | null;
  isManager: boolean;     // this project's PM
  canManage: boolean;     // PM or Society moderator: tasks, allocation
  canContribute: boolean; // Society members: reports on their tasks, RAID items
};

// Society access + the project, or null when either isn't visible.
export async function projectContext(req: NextRequest, rawSocietyId: string, projectId: string): Promise<ProjectContext | null> {
  const a = await societyContentAccess(req, rawSocietyId);
  if (!a || !UUID_RE.test(projectId)) return null;
  const { rows: [project] } = await pool.query(
    `SELECT id, customer_id, name, description, manager_id, status,
            to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date, created_by
     FROM projects WHERE id = $1 AND customer_id = $2 AND deleted_at IS NULL`,
    [projectId, a.societyId],
  );
  if (!project) return null;
  await openRows(a.societyId, [project], ['name', 'description']);
  const me = a.session?.sub ?? null;
  const isManager = !!me && project.manager_id === me;
  return { a, project, me, isManager, canManage: isManager || a.canModerate, canContribute: a.isMember };
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
