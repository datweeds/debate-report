import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sealText } from '@/lib/societyCrypto';
import { lockSafe } from '@/lib/lockSafe';
import { myCategories, readColor, readName, taskAccess } from '@/lib/tasks';

type Params = { params: Promise<{ id: string }> };

// GET — this member's categories.
export async function GET(req: NextRequest, { params }: Params) {
  const r = await taskAccess(req, (await params).id);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ categories: await myCategories(r.a.societyId, r.a.me) });
}

// POST { name, color } — a new category of this member's own.
async function handlePOST(req: NextRequest, { params }: Params) {
  const r = await taskAccess(req, (await params).id);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const b = await req.json().catch(() => ({}));
  const name = readName(b.name);
  if (!name) return NextResponse.json({ error: 'Give the category a name' }, { status: 400 });
  const { rows: [n] } = await pool.query('SELECT COUNT(*)::int AS n FROM task_categories WHERE customer_id = $1 AND owner_id = $2', [r.a.societyId, r.a.me]);
  if (n.n >= 100) return NextResponse.json({ error: 'That’s the most categories you can have' }, { status: 400 });
  const { rows: [c] } = await pool.query(
    `INSERT INTO task_categories (customer_id, owner_id, name, color, sort_order)
     VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM task_categories WHERE customer_id = $1 AND owner_id = $2))
     RETURNING id, color, sort_order`,
    [r.a.societyId, r.a.me, await sealText(r.a.societyId, name, true), readColor(b.color)]);
  return NextResponse.json({ category: { ...c, name } }, { status: 201 });
}

export const POST = lockSafe(handlePOST);
