import { NextResponse } from 'next/server';
import pool, { getCurrentTenantId } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { isSocietyAdmin } from '@/lib/roles';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const currentSocietyId = await getCurrentTenantId();
  if (!(await isSocietyAdmin(session, currentSocietyId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Each row = one flag event; group by statement to show total flag counts.
  // Filtered to the viewer's current Society unless they're SysAdmin.
  const societyFilter = session.isSysAdmin ? '' : 'AND res.customer_id = $1';
  const params = session.isSysAdmin ? [] : [currentSocietyId];

  const { rows } = await pool.query(
    `SELECT
       sf.id, sf.stat_id, sf.reason, sf.created_at,
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
     WHERE 1=1 ${societyFilter}
     ORDER BY sf.created_at DESC
     LIMIT 200`,
    params,
  );

  return NextResponse.json({ flags: rows, total: rows.length });
}
