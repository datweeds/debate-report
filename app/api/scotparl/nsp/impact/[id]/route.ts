import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { canManageDebates } from '@/lib/roles';

const TENANT_ID = parseInt(process.env.TENANT_ID ?? '1', 10);
type Params = { params: Promise<{ id: string }> };

// PATCH — update Topic Owner notes on an existing analysis
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (!await canManageDebates(session, TENANT_ID)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { notes } = await req.json();

  const { rowCount } = await pool.query(
    `UPDATE society_impact_analyses SET notes=$1, updated_at=now()
     WHERE id=$2 AND tenant_id=$3`,
    [notes?.trim() ?? null, id, TENANT_ID]
  );
  if (!rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
