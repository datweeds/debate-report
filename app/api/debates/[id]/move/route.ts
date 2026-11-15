import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { moderatedSocietyIds } from '@/lib/roles';

type Params = { params: Promise<{ id: string }> };

// Moving a debate between Societies changes who moderates it, so the mover
// must moderate both the Society it leaves and the one it joins.
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;
  const { customer_id } = await req.json();
  const targetId = Number(customer_id);
  if (!targetId || isNaN(targetId)) return NextResponse.json({ error: 'customer_id is required' }, { status: 400 });

  const { rows: [current] } = await pool.query(
    `SELECT customer_id FROM statements WHERE id = $1 AND stat_type = 'resolution'`, [id],
  );
  if (!current) return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
  const mine = await moderatedSocietyIds(session.sub);
  if (!mine.includes(current.customer_id) || !mine.includes(targetId)) {
    return NextResponse.json({ error: 'You must moderate both Societies to move a debate' }, { status: 403 });
  }

  const { rows: [society] } = await pool.query('SELECT id, name FROM customers WHERE id = $1', [targetId]);
  if (!society) return NextResponse.json({ error: 'Society not found' }, { status: 404 });

  const { rows } = await pool.query(
    `UPDATE statements SET customer_id = $1 WHERE id = $2 AND stat_type = 'resolution' RETURNING id`,
    [targetId, id]
  );
  if (!rows.length) return NextResponse.json({ error: 'Debate not found' }, { status: 404 });

  return NextResponse.json({ ok: true, society_name: society.name });
}
