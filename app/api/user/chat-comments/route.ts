import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { openDeep } from '@/lib/societyCrypto';

// GET — chat messages this user has posted, across all debates.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { rows } = await pool.query(
    `SELECT c.id, c.comment_body AS body, c.created_at, c.comment_status AS status,
            s.id AS statement_id, s.stat_ref, s.stat_title,
            COALESCE(s.resolution_id, s.id) AS resolution_id,
            COALESCE(r.stat_title, s.stat_title) AS resolution_title
     FROM   comments c
     JOIN   statements s ON s.id = c.statement_id
     LEFT   JOIN statements r ON r.id = s.resolution_id
     WHERE  c.created_by = $1 AND NOT c.is_deleted
     ORDER  BY c.created_at DESC
     LIMIT  300`,
    [session.sub],
  );
  await openDeep(rows);
  return NextResponse.json({ comments: rows });
}
