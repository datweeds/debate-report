import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { isCustomerAdmin } from '@/lib/roles';

const TENANT_ID = parseInt(process.env.TENANT_ID ?? '1', 10);

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const customerAdmin = session.isSysAdmin || await isCustomerAdmin(session.sub, TENANT_ID);

  // Fetch topics this user owns (with straplines)
  const { rows: ownedTopics } = await pool.query(
    `SELECT nt.id, nt.name, to_.strapline
     FROM topic_owners to_
     JOIN nsp_topics nt ON nt.id = to_.topic_id
     WHERE to_.user_id = $1 AND to_.tenant_id = $2
     ORDER BY nt.name`,
    [session.sub, TENANT_ID]
  );

  return NextResponse.json({
    isCustomerAdmin: customerAdmin,
    isTopicOwner: ownedTopics.length > 0,
    ownedTopics,
  });
}
