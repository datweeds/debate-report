import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { moderatedSocietyIds } from '@/lib/roles';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  // Alerts and flags across every Society the viewer moderates (SysAdmin: all)
  const moderated = await moderatedSocietyIds(session.sub);
  const canReviewAlerts  = session.isSysAdmin || moderated.length > 0;
  const alertSocietyFilter = session.isSysAdmin ? '' : 'AND COALESCE(ca.customer_id, r.customer_id) = ANY($1::int[])';
  const flagSocietyFilter = session.isSysAdmin ? '' : 'AND r.customer_id = ANY($1::int[])';
  const alertParams = session.isSysAdmin ? [] : [moderated];

  const [scanRow, flagRow, joinRow, inviteRow, userRow] = await Promise.all([
    // Pending auto-detected content alerts — only meaningful for an admin
    canReviewAlerts
      ? pool.query(
          `SELECT COUNT(*)::int AS n FROM content_alerts ca
           LEFT JOIN statements r ON r.id = ca.resolution_id
           WHERE ca.status = 'pending' ${alertSocietyFilter}`,
          alertParams,
        )
      : Promise.resolve({ rows: [{ n: 0 }] }),
    // User-reported flags (stat_flags has no status column — every row is
    // an open report, same as the Alert Review page treats them)
    canReviewAlerts
      ? pool.query(
          `SELECT COUNT(*)::int AS n FROM stat_flags sf
           LEFT JOIN statements s   ON s.id = sf.stat_id
           LEFT JOIN statements r   ON r.id = s.resolution_id
           WHERE 1=1 ${flagSocietyFilter}`,
          alertParams,
        )
      : Promise.resolve({ rows: [{ n: 0 }] }),
    // Pending requests to join this user's Societies, and Apply-visibility debates in them
    pool.query(
      `SELECT (SELECT COUNT(*)::int FROM society_join_requests sj
               WHERE sj.status = 'pending' AND EXISTS (
                 SELECT 1 FROM customer_roles cr2
                 WHERE cr2.user_id = $1 AND cr2.tenant_id = sj.customer_id AND cr2.role = 'customer_admin'))
            + COUNT(jr.id)::int AS n
       FROM   debate_join_requests jr
       JOIN   statements s ON s.id = jr.resolution_id
       WHERE  jr.status = 'pending'
         AND  s.customer_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM customer_roles cr
                WHERE cr.user_id = $1 AND cr.tenant_id = s.customer_id AND cr.role = 'customer_admin'
              )`,
      [session.sub]
    ),
    // Invitations this user has sent that haven't been accepted/declined yet
    pool.query(
      `SELECT COUNT(id)::int AS n FROM debate_invitations WHERE created_by = $1::uuid AND status = 'pending'`,
      [session.sub]
    ),
    pool.query(
      `SELECT last_statement_id FROM users WHERE id = $1`,
      [session.sub]
    ),
  ]);

  const scannerPending = scanRow.rows[0].n;
  const myPending      = scannerPending + flagRow.rows[0].n;
  const joinsPending   = joinRow.rows[0].n;
  const invitesPending = inviteRow.rows[0].n;

  // lastResolutionId: use last_statement_id (resolution-type statement the user was last in)
  const lastStatementId = userRow.rows[0]?.last_statement_id ?? null;
  let lastResolutionId: string | null = null;
  if (lastStatementId) {
    const { rows: [stmt] } = await pool.query(
      `SELECT id FROM statements WHERE id = $1 AND stat_type = 'resolution'`,
      [lastStatementId]
    );
    lastResolutionId = stmt?.id ?? null;
  }

  return NextResponse.json({ myPending, scannerPending, joinsPending, invitesPending, lastResolutionId });
}
