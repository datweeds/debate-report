import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const [flagsRow, scansRow, joinRow, inviteRow, userRow] = await Promise.all([
    // Pending flags on statements in forums this user owns
    pool.query(
      `SELECT COUNT(af.id)::int AS n
       FROM   alert_flags af
       JOIN   statements s ON s.id = af.statement_id
       JOIN   debate_forums f ON f.id = s.forum_id
       WHERE  f.forum_owner = $1 AND af.flag_status = 'for_review'`,
      [session.sub]
    ),
    // Pending scanner items in forums this user owns
    pool.query(
      `SELECT COUNT(als.id)::int AS n
       FROM   alert_scans als
       JOIN   statements s ON s.id = als.statement_id
       JOIN   debate_forums f ON f.id = s.forum_id
       WHERE  f.forum_owner = $1 AND als.scan_status = 'pending'`,
      [session.sub]
    ),
    // Pending join requests for this user's forums
    pool.query(
      `SELECT COUNT(jr.id)::int AS n
       FROM   join_requests jr
       JOIN   debate_forums f ON f.id = jr.forum_id
       WHERE  f.forum_owner = $1 AND jr.join_status = 'pending'`,
      [session.sub]
    ),
    // Open invitation links with no acceptances yet
    pool.query(
      `SELECT COUNT(i.id)::int AS n
       FROM   invitations i
       JOIN   debate_forums f ON f.id = i.forum_id
       WHERE  f.forum_owner = $1 AND i.invitation_status = 'open' AND i.accepted_count = 0`,
      [session.sub]
    ),
    pool.query(
      `SELECT last_statement_id FROM users WHERE id = $1`,
      [session.sub]
    ),
  ]);

  const myPending      = flagsRow.rows[0].n + scansRow.rows[0].n;
  const scannerPending = scansRow.rows[0].n;
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
