import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sealText } from '@/lib/societyCrypto';
import { lockSafe } from '@/lib/lockSafe';
import { readColor, readName, taskAccess, UUID_RE } from '@/lib/tasks';

type Params = { params: Promise<{ id: string; prid: string }> };

async function moderated(req: NextRequest, params: Params['params']) {
  const { id, prid } = await params;
  const r = await taskAccess(req, id);
  if ('error' in r) return r;
  if (!r.a.canModerate) return { error: 'Only Society Admins can change the priorities', status: 403 };
  if (!UUID_RE.test(prid)) return { error: 'Not found', status: 404 };
  const { rows } = await pool.query('SELECT 1 FROM task_priorities WHERE id = $1 AND customer_id = $2', [prid, r.a.societyId]);
  return rows.length ? { ...r, prid } : { error: 'Not found', status: 404 };
}

// PATCH { name?, color?, sortOrder? } — moderators.
async function handlePATCH(req: NextRequest, { params }: Params) {
  const r = await moderated(req, params);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const b = await req.json().catch(() => ({}));
  const sets: string[] = []; const vals: unknown[] = [];
  const set = (c: string, v: unknown) => { vals.push(v); sets.push(`${c} = $${vals.length}`); };
  if (b.name !== undefined) {
    const name = readName(b.name, 40);
    if (!name) return NextResponse.json({ error: 'Give the priority a name' }, { status: 400 });
    set('name', await sealText(r.a.societyId, name));
  }
  if (b.color !== undefined) set('color', readColor(b.color));
  if (Number.isInteger(b.sortOrder)) set('sort_order', b.sortOrder);
  if (sets.length) { vals.push(r.prid); await pool.query(`UPDATE task_priorities SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals); }
  return NextResponse.json({ ok: true });
}

// DELETE — moderators; tasks with it are left without a priority. The last one stays.
async function handleDELETE(req: NextRequest, { params }: Params) {
  const r = await moderated(req, params);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const { rows: [n] } = await pool.query('SELECT COUNT(*)::int AS n FROM task_priorities WHERE customer_id = $1', [r.a.societyId]);
  if (n.n <= 1) return NextResponse.json({ error: 'Keep at least one priority' }, { status: 400 });
  await pool.query('DELETE FROM task_priorities WHERE id = $1', [r.prid]);
  return NextResponse.json({ ok: true });
}

export const PATCH = lockSafe(handlePATCH);
export const DELETE = lockSafe(handleDELETE);
