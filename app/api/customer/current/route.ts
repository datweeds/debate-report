import { NextRequest, NextResponse } from 'next/server';
import pool, { getCurrentTenantId } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

// "Society" is the user-facing term for a customer/tenant (see lib/db.ts).
// No auth required — logged-out visitors need this to render the switcher
// and to see which societies are public.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const currentId = await getCurrentTenantId();

  const { rows: currentRows } = await pool.query('SELECT id, name FROM customers WHERE id = $1', [currentId]);
  const { rows: publicRows } = await pool.query(
    'SELECT id, name FROM customers WHERE is_public = true ORDER BY name'
  );

  let privateRows: { id: number; name: string }[] = [];
  if (session) {
    if (session.isSysAdmin) {
      const { rows } = await pool.query(
        'SELECT id, name FROM customers WHERE is_public = false ORDER BY name'
      );
      privateRows = rows;
    } else {
      const { rows } = await pool.query(
        `SELECT c.id, c.name FROM customers c
         JOIN customer_members cm ON cm.customer_id = c.id
         WHERE c.is_public = false AND cm.user_id = $1
         ORDER BY c.name`,
        [session.sub]
      );
      privateRows = rows;
    }
  }

  return NextResponse.json({
    current: currentRows[0] ?? null,
    public: publicRows,
    private: privateRows,
  });
}
