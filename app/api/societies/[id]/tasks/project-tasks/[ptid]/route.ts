import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { lockSafe } from '@/lib/lockSafe';
import { ownCategoryIds, setMyCategories, taskAccess, UUID_RE } from '@/lib/tasks';

type Params = { params: Promise<{ id: string; ptid: string }> };

// PUT { categoryIds } — this member's own categories on a Project Task (only they see them).
async function handlePUT(req: NextRequest, { params }: Params) {
  const { id, ptid } = await params;
  const r = await taskAccess(req, id);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (!UUID_RE.test(ptid)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { rows } = await pool.query(
    `SELECT 1 FROM project_tasks t JOIN projects p ON p.id = t.project_id
     WHERE t.id = $1 AND p.customer_id = $2 AND p.deleted_at IS NULL`, [ptid, r.a.societyId]);
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const cats = await ownCategoryIds(r.a.societyId, r.a.me, b.categoryIds ?? []);
  await setMyCategories(r.a.me, { projectTaskId: ptid }, cats ?? []);
  return NextResponse.json({ ok: true });
}

export const PUT = lockSafe(handlePUT);
