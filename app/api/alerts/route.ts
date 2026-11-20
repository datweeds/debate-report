import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { moderatedSocietyIds } from '@/lib/roles';
import { hideEndToEnd, openDeep, openText } from '@/lib/societyCrypto';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const url  = new URL(req.url);
  const mine = url.searchParams.get('mine') === 'true';

  // The review queue (!mine) covers every Society the viewer moderates
  // (SysAdmin: everything, including profiles, which belong to no Society).
  // "mine" (a user's own flagged content, to appeal) is open to anyone logged in.
  const moderated = await moderatedSocietyIds(session.sub);
  if (!mine && !session.isSysAdmin && !moderated.length) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const status = url.searchParams.get('status') ?? 'pending';
  const page   = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const limit  = 30;
  const offset = (page - 1) * limit;

  // Build the filter clause and its params from scratch each time, rather
  // than juggling shared positional placeholders across branches.
  let filterClause = 'ca.status = $1';
  const filterParams: (string | number | number[])[] = [status];
  if (mine) {
    filterClause += ` AND ca.author_id = $${filterParams.length + 1}`;
    filterParams.push(session.sub);
  } else if (!session.isSysAdmin) {
    filterClause += ` AND COALESCE(ca.customer_id, r.customer_id) = ANY($${filterParams.length + 1}::int[])`;
    filterParams.push(moderated);
  }

  const [{ rows: alerts }, { rows: [{ total }] }] = await Promise.all([
    pool.query(
      `SELECT
         ca.id, ca.content_type, ca.content_id, ca.resolution_id, ca.content_href,
         soc.name        AS society_name, soc.id AS society_id, soc.visibility AS society_visibility,
         ca.flagged_text, ca.flags, ca.status, ca.created_at, ca.reviewed_at,
         ca.appeal_body, ca.appeal_at, ca.appeal_status,
         u.user_handle   AS author_handle,
         u.email         AS author_email,
         rv.user_handle  AS reviewed_by_handle,
         s.stat_title    AS statement_title,
         r.stat_title    AS resolution_title,
         owner.user_handle AS owner_handle,
         owner.email       AS owner_email,
         rep.user_handle   AS reporter_handle,
         ca.report_reason
       FROM content_alerts ca
       LEFT JOIN users      u     ON u.id     = ca.author_id
       LEFT JOIN users      rv    ON rv.id    = ca.reviewed_by
       LEFT JOIN statements s     ON s.id     = ca.content_id
       LEFT JOIN statements r     ON r.id     = ca.resolution_id
       LEFT JOIN users      owner ON owner.id = r.created_by
       LEFT JOIN users      rep   ON rep.id   = ca.reported_by
       LEFT JOIN customers  soc   ON soc.id   = COALESCE(ca.customer_id, r.customer_id)
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

  // Private Societies: SysAdmin sees only that an alert exists, unless they
  // moderate it or hold a break-glass grant. Flagged text is stored
  // encrypted for private Societies; decrypt it for those allowed to see it.
  const granted = new Set<number>();
  if (session.isSysAdmin) {
    const { rows } = await pool.query(
      `SELECT DISTINCT customer_id FROM sysadmin_access WHERE user_id = $1 AND ended_at IS NULL AND expires_at > now()`, [session.sub]);
    for (const r of rows) granted.add(r.customer_id);
  }
  for (const al of alerts) {
    const sid = al.society_id as number | null;
    const hidden = !mine && sid != null && al.society_visibility !== 'public' && !moderated.includes(sid) && !granted.has(sid);
    if (hidden) {
      Object.assign(al, { flagged_text: null, appeal_body: null, author_email: null, owner_email: null,
        statement_title: null, resolution_title: null, report_reason: null, content_hidden: true });
    } else if (sid != null) {
      al.flagged_text = await openText(sid, al.flagged_text);
      al.appeal_body = await openText(sid, al.appeal_body);
      al.report_reason = await openText(sid, al.report_reason);
    }
  }
  await openDeep(alerts);
  await hideEndToEnd(alerts);  // sealed debates: only members' browsers can open them  // the rest: debate titles in the queue
  return NextResponse.json({ alerts, total, page, limit });
}
