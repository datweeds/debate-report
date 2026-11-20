import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { moderatedSocietyIds } from '@/lib/roles';
import { sysAdminSocietySql } from '@/lib/breakGlass';
import { hideEndToEnd, openDeep } from '@/lib/societyCrypto';

// GET ?status=open (default) | cleared — cleared flags are kept as a record
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const moderated = await moderatedSocietyIds(session.sub);
  if (!session.isSysAdmin && !moderated.length) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Each row = one flag event; group by statement to show total flag counts.
  // Every Society the viewer moderates (SysAdmin: all).
  // SysAdmin: everything except private Societies they hold no break-glass grant for
  // A flag on a motion has no parent debate: use the motion's own Society
  const cid = 'COALESCE(res.customer_id, s.customer_id)';
  const societyFilter = session.isSysAdmin
    ? `AND (${cid} = ANY($1::int[]) OR ${sysAdminSocietySql(cid, '$2::text')})`
    : `AND ${cid} = ANY($1::int[])`;
  const params = session.isSysAdmin ? [moderated, session.sub] : [moderated];
  const cleared = req.nextUrl.searchParams.get('status') === 'cleared';

  const { rows } = await pool.query(
    `SELECT
       sf.id, sf.stat_id, sf.reason, sf.created_at, sf.resolved_at,
       resolver.user_handle AS resolver_handle,
       flagger.user_handle  AS flagger_handle,
       flagger.email        AS flagger_email,
       author.user_handle   AS author_handle,
       author.email         AS author_email,
       owner.user_handle    AS owner_handle,
       owner.email          AS owner_email,
       s.stat_title         AS statement_title,
       s.resolution_id,
       res.stat_title       AS resolution_title,
       (SELECT COUNT(*)::int FROM stat_flags sf2 WHERE sf2.stat_id = sf.stat_id) AS total_flags
     FROM stat_flags sf
     LEFT JOIN users      flagger ON flagger.id = sf.flagged_by
     LEFT JOIN statements s       ON s.id       = sf.stat_id
     LEFT JOIN users      author  ON author.id  = s.created_by
     LEFT JOIN statements res     ON res.id     = s.resolution_id
     LEFT JOIN users      owner   ON owner.id   = res.created_by
     LEFT JOIN users      resolver ON resolver.id = sf.resolved_by
     WHERE sf.resolved_at IS ${cleared ? 'NOT NULL' : 'NULL'} ${societyFilter}
     ORDER BY ${cleared ? 'sf.resolved_at' : 'sf.created_at'} DESC
     LIMIT 200`,
    params,
  );

  await openDeep(rows);
  await hideEndToEnd(rows);  // sealed debates: only members' browsers can open them
  return NextResponse.json({ flags: rows, total: rows.length });
}

// PATCH { id } — a moderator clears a flag: reviewed, no action needed. It stays
// on record but is no longer open. Moderators of the statement's Society, or Sys Admin.
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const { rows: [f] } = await pool.query(
    `SELECT sf.id, COALESCE(res.customer_id, s.customer_id) AS cid FROM stat_flags sf
     LEFT JOIN statements s ON s.id = sf.stat_id LEFT JOIN statements res ON res.id = s.resolution_id
     WHERE sf.id = $1 AND sf.resolved_at IS NULL`, [id]);
  if (!f) return NextResponse.json({ error: 'Flag not found, or already cleared' }, { status: 404 });
  if (!session.isSysAdmin && !(f.cid != null && (await moderatedSocietyIds(session.sub)).includes(f.cid))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await pool.query('UPDATE stat_flags SET resolved_at = now(), resolved_by = $2 WHERE id = $1', [id, session.sub]);
  return NextResponse.json({ ok: true });
}
