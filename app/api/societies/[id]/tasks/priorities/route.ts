import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sealText } from '@/lib/societyCrypto';
import { lockSafe } from '@/lib/lockSafe';
import { priorities, readColor, readName, taskAccess } from '@/lib/tasks';

type Params = { params: Promise<{ id: string }> };

// GET — the Society's priorities (High / Medium / Low until moderators change them).
export async function GET(req: NextRequest, { params }: Params) {
  const r = await taskAccess(req, (await params).id);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ priorities: await priorities(r.a.societyId), canManage: r.a.canModerate });
}

// POST { name, color } — moderators.
async function handlePOST(req: NextRequest, { params }: Params) {
  const r = await taskAccess(req, (await params).id);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (!r.a.canModerate) return NextResponse.json({ error: 'Only Society Admins can change the priorities' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const name = readName(b.name, 40);
  if (!name) return NextResponse.json({ error: 'Give the priority a name' }, { status: 400 });
  await priorities(r.a.societyId);   // the defaults first, so a new one goes after them
  const { rows: [n] } = await pool.query('SELECT COUNT(*)::int AS n FROM task_priorities WHERE customer_id = $1', [r.a.societyId]);
  if (n.n >= 12) return NextResponse.json({ error: 'That’s the most priorities a Society can have' }, { status: 400 });
  const { rows: [p] } = await pool.query(
    `INSERT INTO task_priorities (customer_id, name, color, sort_order)
     VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM task_priorities WHERE customer_id = $1))
     RETURNING id, color, sort_order`,
    [r.a.societyId, await sealText(r.a.societyId, name), readColor(b.color)]);
  return NextResponse.json({ priority: { ...p, name } }, { status: 201 });
}

export const POST = lockSafe(handlePOST);
