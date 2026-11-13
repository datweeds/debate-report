import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// Moving a debate between societies crosses tenant boundaries (it changes
// which customer_admin manages it, and which society's proposals/principles
// it's grouped with) — sysadmin-only, unlike the debate-level moderator
// actions (close, purge-retracted) which the debate's own creator can do too.
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (!session.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const { customer_id } = await req.json();
  const targetId = Number(customer_id);
  if (!targetId || isNaN(targetId)) return NextResponse.json({ error: 'customer_id is required' }, { status: 400 });

  const { rows: [society] } = await pool.query('SELECT id, name FROM customers WHERE id = $1', [targetId]);
  if (!society) return NextResponse.json({ error: 'Society not found' }, { status: 404 });

  const { rows } = await pool.query(
    `UPDATE statements SET customer_id = $1 WHERE id = $2 AND stat_type = 'resolution' RETURNING id`,
    [targetId, id]
  );
  if (!rows.length) return NextResponse.json({ error: 'Debate not found' }, { status: 404 });

  return NextResponse.json({ ok: true, society_name: society.name });
}
