import { NextResponse } from 'next/server';
import pool, { tq } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canManageDebates } from '@/lib/roles';

const TENANT_ID = parseInt(process.env.TENANT_ID ?? '1', 10);

// GET — all flags for this tenant (so list pages can show flag state)
export async function GET() {
  const session = await getSession();
  if (!session || !await canManageDebates(session, TENANT_ID)) {
    return NextResponse.json({ flags: [] });
  }
  const res = await tq<{ entity_type: string; entity_id: number; flagged_by: string; flagged_at: string; notes: string | null }>(
    `SELECT entity_type, entity_id, flagged_by, flagged_at, notes
     FROM society_interest_flags
     WHERE tenant_id = current_setting('app.tenant_id')::int
     ORDER BY flagged_at DESC`
  );
  return NextResponse.json({ flags: res.rows });
}

// POST — toggle flag for an entity
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !await canManageDebates(session, TENANT_ID)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { entity_type, entity_id, notes } = await req.json().catch(() => ({}));
  if (!entity_type || !entity_id) {
    return NextResponse.json({ error: 'entity_type and entity_id required' }, { status: 400 });
  }

  // Toggle: if already flagged remove it, otherwise add
  const existing = await pool.query(
    `SELECT id FROM society_interest_flags WHERE tenant_id=$1 AND entity_type=$2 AND entity_id=$3`,
    [TENANT_ID, entity_type, entity_id]
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `DELETE FROM society_interest_flags WHERE tenant_id=$1 AND entity_type=$2 AND entity_id=$3`,
      [TENANT_ID, entity_type, entity_id]
    );
    return NextResponse.json({ flagged: false });
  }

  await pool.query(
    `INSERT INTO society_interest_flags (tenant_id, entity_type, entity_id, flagged_by, notes)
     VALUES ($1,$2,$3,$4,$5)`,
    [TENANT_ID, entity_type, entity_id, session.sub, notes ?? null]
  );
  return NextResponse.json({ flagged: true });
}
