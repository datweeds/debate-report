import { NextRequest, NextResponse } from 'next/server';
import pool, { getCurrentTenantId } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

// "Society" is the user-facing term for a customer/tenant (see lib/db.ts).
// No auth required — logged-out visitors need this to render the switcher.
//   public: every public Society
//   private: every Apply Society (anyone may ask to join), plus Invite
//            Societies the visitor belongs to or moderates
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const currentId = await getCurrentTenantId();
  const uid = session?.sub ?? null;

  const { rows: currentRows } = await pool.query('SELECT id, name FROM customers WHERE id = $1', [currentId]);
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.visibility,
            EXISTS (SELECT 1 FROM customer_members m WHERE m.customer_id = c.id AND m.user_id = $1)
            OR EXISTS (SELECT 1 FROM customer_roles r WHERE r.tenant_id = c.id AND r.user_id = $1 AND r.role = 'customer_admin') AS is_member
     FROM customers c
     WHERE c.status = 'active' OR c.status IS NULL
     ORDER BY c.name`,
    [uid],
  );

  const toOption = (r: { id: number; name: string; visibility: string; is_member: boolean }) =>
    ({ id: r.id, name: r.name, visibility: r.visibility, isMember: r.is_member });
  return NextResponse.json({
    current: currentRows[0] ?? null,
    public: rows.filter(r => r.visibility === 'public').map(toOption),
    private: rows.filter(r => r.visibility === 'apply' || (r.visibility === 'invite' && r.is_member)).map(toOption),
  });
}
