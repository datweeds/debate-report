import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;

  const { rows: [stmt] } = await pool.query(
    'SELECT id, created_by, stat_type FROM statements WHERE id = $1',
    [id],
  );
  if (!stmt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (stmt.created_by !== session.sub && !session.isSysAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Recursively retract the statement and all dependents (statements that support it)
  const { rows } = await pool.query(
    `WITH RECURSIVE deps AS (
       SELECT $1::uuid AS id
       UNION
       SELECT sr.stat_id_supported_by
       FROM   stat_relationships sr
       JOIN   deps d ON sr.stat_id_supported = d.id
     )
     UPDATE statements
     SET    retracted_at = NOW()
     WHERE  id IN (SELECT id FROM deps) AND retracted_at IS NULL
     RETURNING id`,
    [id],
  );

  return NextResponse.json({ retracted: rows.map((r: { id: string }) => r.id) });
}
