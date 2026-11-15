import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET — the Societies the logged-in user moderates (for the menu and Manage pages).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ moderatedSocieties: [] });
  const { rows } = await pool.query(
    `SELECT c.id, c.name FROM customer_roles cr JOIN customers c ON c.id = cr.tenant_id
     WHERE cr.user_id = $1 AND cr.role = 'customer_admin' ORDER BY c.name`,
    [session.sub],
  );
  return NextResponse.json({ moderatedSocieties: rows });
}
