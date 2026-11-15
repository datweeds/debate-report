import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// Permanently deletes every retracted statement in this debate. ON DELETE
// CASCADE already covers stat_votes, stat_relationships, comments, flags
// etc. — nothing else needs touching. Resolutions are never a target (their
// own resolution_id is null, so they can't match the WHERE clause), so the
// debate itself can never be wiped out by this.
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;

  const { rows: [debate] } = await pool.query(
    `SELECT id, created_by, customer_id FROM statements WHERE id = $1 AND stat_type = 'resolution'`,
    [id]
  );
  if (!debate) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { isSocietyModerator } = await import('@/lib/roles');
  if (!await isSocietyModerator(session, debate.customer_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { rows } = await pool.query(
    `DELETE FROM statements WHERE resolution_id = $1 AND retracted_at IS NOT NULL RETURNING id`,
    [id]
  );

  return NextResponse.json({ deleted: rows.map(r => r.id) });
}
