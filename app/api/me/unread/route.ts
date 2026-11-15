import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { unreadCounts } from '@/lib/unread';

// GET — new items per section for every Society the viewer belongs to or
// moderates (for the menu's badges), keyed by Society id.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ societies: {} });
  const { rows } = await pool.query(
    `SELECT customer_id AS id FROM customer_members WHERE user_id = $1
     UNION SELECT tenant_id FROM customer_roles WHERE user_id = $1 AND role = 'customer_admin'`, [session.sub]);
  const counts = await unreadCounts(session.sub, rows.map(r => r.id as number));
  return NextResponse.json({ societies: Object.fromEntries(counts) });
}
