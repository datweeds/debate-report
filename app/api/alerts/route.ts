import { NextRequest, NextResponse } from 'next/server';
import pool, { getCurrentTenantId } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { isSocietyAdmin } from '@/lib/roles';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const url  = new URL(req.url);
  const mine = url.searchParams.get('mine') === 'true';

  // The moderation review queue (!mine) is Society Admin/SysAdmin only, and
  // filtered to the viewer's current Society unless they're SysAdmin — "mine"
  // (a user's own masked content, to appeal) stays open to anyone logged in.
  const currentSocietyId = await getCurrentTenantId();
  if (!mine && !(await isSocietyAdmin(session, currentSocietyId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const status = url.searchParams.get('status') ?? 'pending';
  const page   = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const limit  = 30;
  const offset = (page - 1) * limit;

  // Build the filter clause and its params from scratch each time, rather
  // than juggling shared positional placeholders across branches.
  let filterClause = 'ca.status = $1';
  const filterParams: (string | number)[] = [status];
  if (mine) {
    filterClause += ` AND ca.author_id = $${filterParams.length + 1}`;
    filterParams.push(session.sub);
  } else if (!session.isSysAdmin) {
    filterClause += ` AND r.customer_id = $${filterParams.length + 1}`;
    filterParams.push(currentSocietyId);
  }

  const [{ rows: alerts }, { rows: [{ total }] }] = await Promise.all([
    pool.query(
      `SELECT
         ca.id, ca.content_type, ca.content_id, ca.resolution_id,
         ca.flagged_text, ca.flags, ca.status, ca.created_at, ca.reviewed_at,
         ca.appeal_body, ca.appeal_at, ca.appeal_status,
         u.user_handle   AS author_handle,
         u.email         AS author_email,
         rv.user_handle  AS reviewed_by_handle,
         s.stat_title    AS statement_title,
         r.stat_title    AS resolution_title,
         owner.user_handle AS owner_handle,
         owner.email       AS owner_email
       FROM content_alerts ca
       LEFT JOIN users      u     ON u.id     = ca.author_id
       LEFT JOIN users      rv    ON rv.id    = ca.reviewed_by
       LEFT JOIN statements s     ON s.id     = ca.content_id
       LEFT JOIN statements r     ON r.id     = ca.resolution_id
       LEFT JOIN users      owner ON owner.id = r.created_by
       WHERE ${filterClause}
       ORDER BY ca.created_at DESC
       LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`,
      [...filterParams, limit, offset],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total
       FROM content_alerts ca
       LEFT JOIN statements r ON r.id = ca.resolution_id
       WHERE ${filterClause}`,
      filterParams,
    ),
  ]);

  return NextResponse.json({ alerts, total, page, limit });
}
