import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const isMod = session.tier === 'moderator' || session.isSysAdmin;
  const url   = new URL(req.url);
  const mine  = url.searchParams.get('mine') === 'true';

  // Non-moderators can only see their own alerts
  if (!isMod && !mine) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const status = url.searchParams.get('status') ?? 'pending';
  const page   = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const limit  = 30;
  const offset = (page - 1) * limit;

  const whereClause = mine
    ? `WHERE ca.status = $1 AND ca.author_id = $4`
    : `WHERE ca.status = $1`;

  const params: (string | number)[] = mine
    ? [status, limit, offset, session.sub]
    : [status, limit, offset];

  const [{ rows: alerts }, { rows: [{ total }] }] = await Promise.all([
    pool.query(
      `SELECT
         ca.id, ca.content_type, ca.content_id, ca.resolution_id,
         ca.flagged_text, ca.flags, ca.status, ca.created_at, ca.reviewed_at,
         ca.appeal_body, ca.appeal_at, ca.appeal_status,
         u.user_handle   AS author_handle,
         rv.user_handle  AS reviewed_by_handle,
         s.stat_title    AS statement_title,
         r.stat_title    AS resolution_title
       FROM content_alerts ca
       LEFT JOIN users      u  ON u.id  = ca.author_id
       LEFT JOIN users      rv ON rv.id = ca.reviewed_by
       LEFT JOIN statements s  ON s.id  = ca.content_id
       LEFT JOIN statements r  ON r.id  = ca.resolution_id
       ${whereClause}
       ORDER BY ca.created_at DESC
       LIMIT $2 OFFSET $3`,
      params,
    ),
    pool.query(
      mine
        ? `SELECT COUNT(*)::int AS total FROM content_alerts WHERE status = $1 AND author_id = $2`
        : `SELECT COUNT(*)::int AS total FROM content_alerts WHERE status = $1`,
      mine ? [status, session.sub] : [status],
    ),
  ]);

  return NextResponse.json({ alerts, total, page, limit });
}
