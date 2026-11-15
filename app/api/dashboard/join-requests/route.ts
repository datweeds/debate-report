import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

// Aggregate across every debate the viewer can administer (their own
// Societies, or all of them if SysAdmin) — replaces the old "across every
// forum I own" listing.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { rows } = await pool.query(
    `SELECT jr.id, jr.resolution_id, s.stat_title AS debate_title,
            jr.user_id, u.user_handle, u.user_full_name,
            jr.message, jr.status, jr.created_at,
            c.name AS society_name
     FROM debate_join_requests jr
     JOIN statements s ON s.id = jr.resolution_id
     LEFT JOIN users u ON u.id::text = jr.user_id
     LEFT JOIN customers c ON c.id = s.customer_id
     WHERE s.customer_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM customer_roles cr
             WHERE cr.user_id = $1 AND cr.tenant_id = s.customer_id AND cr.role = 'customer_admin'
           )
     ORDER BY jr.created_at DESC`,
    [session.sub]
  );
  return NextResponse.json(rows);
}
