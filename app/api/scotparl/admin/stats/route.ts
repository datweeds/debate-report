import { NextRequest, NextResponse } from 'next/server';
import pool, { tq } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { isCustomerAdmin } from '@/lib/roles';

const TENANT_ID = parseInt(process.env.TENANT_ID ?? '1', 10);

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const canAdmin = session.isSysAdmin || await isCustomerAdmin(session.sub, TENANT_ID);

  const { searchParams } = new URL(req.url);
  const topicId = searchParams.get('topic_id') ? parseInt(searchParams.get('topic_id')!, 10) : null;

  // TopicOwners can only view stats for their assigned topics
  if (!canAdmin && topicId) {
    const { rows } = await pool.query(
      `SELECT 1 FROM topic_owners WHERE user_id = $1 AND topic_id = $2 AND tenant_id = $3 LIMIT 1`,
      [session.sub, topicId, TENANT_ID]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (topicId) {
    // Topic-scoped stats
    const { rows: [counts] } = await tq(`
      SELECT
        COUNT(p.id)::int                                                           AS proposals_total,
        COUNT(p.id) FILTER (WHERE p.status IN ('proposed','amended'))::int         AS proposals_pending,
        COUNT(p.id) FILTER (WHERE p.status = 'accepted')::int                      AS proposals_accepted,
        COUNT(p.id) FILTER (WHERE p.status = 'rejected')::int                      AS proposals_rejected,
        COUNT(DISTINCT spd.id)::int                                                AS debates_total,
        COUNT(DISTINCT sbpp.pvc_poll_id)::int                                      AS votes_total
      FROM proposals p
      LEFT JOIN sp_proposal_debates spd ON spd.proposal_id = p.id
      LEFT JOIN sp_bill_pvc_polls sbpp ON sbpp.sp_bill_id IS NOT NULL AND false -- no bill votes per topic
      WHERE p.topic_id = $1
    `, [topicId]);

    const { rows: recent } = await tq(`
      SELECT p.id, p.title, p.status, p.created_at, p.updated_at,
             nt.name AS topic_name
      FROM proposals p
      LEFT JOIN nsp_topics nt ON nt.id = p.topic_id
      WHERE p.topic_id = $1
      ORDER BY p.updated_at DESC
      LIMIT 10
    `, [topicId]);

    return NextResponse.json({ counts, recent });
  }

  // Tenant-wide stats (CustomerAdmin / SysAdmin only for unfiltered)
  if (!canAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { rows: [counts] } = await tq(`
    SELECT
      (SELECT COUNT(*)::int FROM proposals)                                         AS proposals_total,
      (SELECT COUNT(*)::int FROM proposals WHERE status IN ('proposed','amended'))  AS proposals_pending,
      (SELECT COUNT(*)::int FROM proposals WHERE status = 'accepted')               AS proposals_accepted,
      (SELECT COUNT(*)::int FROM proposals WHERE status = 'rejected')               AS proposals_rejected,
      (SELECT COUNT(*)::int FROM sp_proposal_debates) +
        (SELECT COUNT(*)::int FROM sp_bill_debates)                                AS debates_total,
      (SELECT COUNT(*)::int FROM sp_bill_pvc_polls)                                AS votes_total,
      (SELECT COUNT(*)::int FROM nsp_topics)                                       AS topics_total,
      (SELECT COUNT(DISTINCT user_id)::int FROM topic_owners WHERE tenant_id = $1) AS topic_owners_total
  `, [TENANT_ID]);

  const { rows: recent } = await tq(`
    SELECT p.id, p.title, p.status, p.created_at, p.updated_at,
           nt.name AS topic_name
    FROM proposals p
    LEFT JOIN nsp_topics nt ON nt.id = p.topic_id
    ORDER BY p.updated_at DESC
    LIMIT 10
  `);

  return NextResponse.json({ counts, recent });
}
