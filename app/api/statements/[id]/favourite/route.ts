import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// GET — check if the current user has favourited this statement/resolution
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ isFavourite: false });

  const { rows } = await pool.query(
    `SELECT id FROM stat_favs WHERE statement_id = $1 AND created_by = $2`,
    [id, session.sub],
  );
  return NextResponse.json({ isFavourite: rows.length > 0 });
}

// POST — toggle favourite status
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { rows: [stmt] } = await pool.query(
    `SELECT id FROM statements WHERE id = $1`,
    [id],
  );
  if (!stmt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Check current state
  const { rows: existing } = await pool.query(
    `SELECT id FROM stat_favs WHERE statement_id = $1 AND created_by = $2`,
    [id, session.sub],
  );

  if (existing.length > 0) {
    await pool.query(
      `DELETE FROM stat_favs WHERE statement_id = $1 AND created_by = $2`,
      [id, session.sub],
    );
    return NextResponse.json({ isFavourite: false });
  } else {
    await pool.query(
      `INSERT INTO stat_favs (statement_id, created_by) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [id, session.sub],
    );
    return NextResponse.json({ isFavourite: true });
  }
}
