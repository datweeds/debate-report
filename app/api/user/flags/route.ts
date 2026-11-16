import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { openDeep } from '@/lib/societyCrypto';

// GET — flags this user raised on statements, and flags others raised on this
// user's statements (who flagged is not revealed).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const cols = `f.id, f.reason, f.created_at, s.id AS statement_id, s.stat_ref, s.stat_title,
                COALESCE(s.resolution_id, s.id) AS resolution_id,
                COALESCE(r.stat_title, s.stat_title) AS resolution_title`;
  const from = `FROM stat_flags f
                JOIN statements s ON s.id = f.stat_id
                LEFT JOIN statements r ON r.id = s.resolution_id`;
  const [{ rows: raised }, { rows: against }] = await Promise.all([
    pool.query(`SELECT ${cols} ${from} WHERE f.flagged_by = $1 ORDER BY f.created_at DESC LIMIT 200`, [session.sub]),
    pool.query(`SELECT ${cols} ${from} WHERE s.created_by = $1 AND f.flagged_by <> $1 ORDER BY f.created_at DESC LIMIT 200`, [session.sub]),
  ]);
  await openDeep([raised, against]);
  return NextResponse.json({ raised, against });
}
