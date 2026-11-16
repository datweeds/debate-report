import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { openForSysAdmin } from '@/lib/debateCrypto';

// SysAdmin: every debate, for choosing what an Access Key unlocks.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { rows } = await pool.query(`
    SELECT s.id, s.stat_title AS title, s.debate_visibility AS visibility, c.name AS society, s.customer_id AS society_id
    FROM statements s
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.stat_type = 'resolution'
    ORDER BY c.name NULLS LAST, s.created_at
  `);
  await openForSysAdmin(session, rows, r => r.society_id);
  return NextResponse.json(rows);
}
