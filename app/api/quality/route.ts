import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

// GET — debates in the Societies this user moderates, with the latest result for each.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const { rows } = await pool.query(
    `SELECT r.id, r.stat_title AS title, r.debate_visibility AS visibility, c.name AS society,
            (SELECT COUNT(*)::int FROM statements s WHERE s.resolution_id = r.id AND s.retracted_at IS NULL) AS statement_count,
            q.score, q.created_at AS last_run, q.status AS last_status
     FROM   statements r
     LEFT   JOIN customers c ON c.id = r.customer_id
     LEFT   JOIN LATERAL (
       SELECT score, created_at, status FROM quality_reports
       WHERE resolution_id = r.id ORDER BY created_at DESC LIMIT 1
     ) q ON TRUE
     WHERE  r.stat_type = 'resolution'
       AND  r.customer_id IN (
              SELECT tenant_id FROM customer_roles WHERE user_id = $1 AND role = 'customer_admin')
     ORDER  BY c.name NULLS LAST, r.stat_title`,
    [session.sub],
  );
  return NextResponse.json({ debates: rows });
}
