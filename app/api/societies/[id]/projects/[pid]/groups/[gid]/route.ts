import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sealText } from '@/lib/societyCrypto';
import { projectContext, text, UUID_RE, ptext } from '@/lib/projects';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string; pid: string; gid: string }> };

async function load(req: NextRequest, id: string, pid: string, gid: string) {
  const c = await projectContext(req, id, pid);
  if (!c || !UUID_RE.test(gid)) return null;
  const { rows: [g] } = await pool.query('SELECT id, sort_order FROM project_task_groups WHERE id = $1 AND project_id = $2', [gid, pid]);
  return g ? { c, g } : null;
}

// PATCH { name?, move?: 'up' | 'down' } — the PM or a moderator renames or reorders a group.
async function handlePATCH(req: NextRequest, { params }: Params) {
  const { id, pid, gid } = await params;
  const x = await load(req, id, pid, gid);
  if (!x) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!x.c.canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if ('name' in b) {
    const name = ptext(x.c, b.name, 120);
    if (!name) return NextResponse.json({ error: 'A group name is required' }, { status: 400 });
    await pool.query('UPDATE project_task_groups SET name = $1 WHERE id = $2', [await sealText(x.c.a.societyId, name), gid]);
  }
  if (b.move === 'up' || b.move === 'down') {
    const { rows: [other] } = await pool.query(
      `SELECT id, sort_order FROM project_task_groups WHERE project_id = $1 AND sort_order ${b.move === 'up' ? '<' : '>'} $2
       ORDER BY sort_order ${b.move === 'up' ? 'DESC' : 'ASC'} LIMIT 1`, [pid, x.g.sort_order]);
    if (other) {
      await pool.query('UPDATE project_task_groups SET sort_order = $1 WHERE id = $2', [other.sort_order, gid]);
      await pool.query('UPDATE project_task_groups SET sort_order = $1 WHERE id = $2', [x.g.sort_order, other.id]);
    }
  }
  return NextResponse.json({ ok: true });
}

// DELETE — the group goes; its tasks stay, ungrouped.
async function handleDELETE(req: NextRequest, { params }: Params) {
  const { id, pid, gid } = await params;
  const x = await load(req, id, pid, gid);
  if (!x) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!x.c.canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await pool.query('DELETE FROM project_task_groups WHERE id = $1', [gid]);
  return NextResponse.json({ ok: true });
}

export const PATCH = lockSafe(handlePATCH);
export const DELETE = lockSafe(handleDELETE);
