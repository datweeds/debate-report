import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sealText } from '@/lib/societyCrypto';
import { lockSafe } from '@/lib/lockSafe';
import { readColor, readName, taskAccess, UUID_RE } from '@/lib/tasks';

type Params = { params: Promise<{ id: string; cid: string }> };

async function mine(req: NextRequest, params: Params['params']) {
  const { id, cid } = await params;
  const r = await taskAccess(req, id);
  if ('error' in r) return r;
  if (!UUID_RE.test(cid)) return { error: 'Not found', status: 404 };
  const { rows } = await pool.query('SELECT 1 FROM task_categories WHERE id = $1 AND customer_id = $2 AND owner_id = $3', [cid, r.a.societyId, r.a.me]);
  return rows.length ? { ...r, cid } : { error: 'Not found', status: 404 };
}

// PATCH { name?, color?, sortOrder? } — the member's own category.
async function handlePATCH(req: NextRequest, { params }: Params) {
  const r = await mine(req, params);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const b = await req.json().catch(() => ({}));
  const sets: string[] = []; const vals: unknown[] = [];
  const set = (c: string, v: unknown) => { vals.push(v); sets.push(`${c} = $${vals.length}`); };
  if (b.name !== undefined) {
    const name = readName(b.name);
    if (!name) return NextResponse.json({ error: 'Give the category a name' }, { status: 400 });
    set('name', await sealText(r.a.societyId, name, true));
  }
  if (b.color !== undefined) set('color', readColor(b.color));
  if (Number.isInteger(b.sortOrder)) set('sort_order', b.sortOrder);
  if (sets.length) { vals.push(r.cid); await pool.query(`UPDATE task_categories SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals); }
  return NextResponse.json({ ok: true });
}

// DELETE — removes it from every task it was on.
async function handleDELETE(req: NextRequest, { params }: Params) {
  const r = await mine(req, params);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  await pool.query('DELETE FROM task_categories WHERE id = $1', [r.cid]);
  return NextResponse.json({ ok: true });
}

export const PATCH = lockSafe(handlePATCH);
export const DELETE = lockSafe(handleDELETE);
