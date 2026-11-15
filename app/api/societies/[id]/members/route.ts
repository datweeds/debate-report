import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';

type Params = { params: Promise<{ id: string }> };

// GET — the Society's members and moderators, for choosing a Project Manager
// or who to allocate to a task. Members only.
export async function GET(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { rows } = await pool.query(
    `SELECT u.id, u.user_handle AS handle, u.user_full_name AS name
     FROM users u
     WHERE u.id::text IN (SELECT user_id FROM customer_members WHERE customer_id = $1
                          UNION SELECT user_id FROM customer_roles WHERE tenant_id = $1 AND role = 'customer_admin')
     ORDER BY u.user_handle`,
    [a.societyId],
  );
  return NextResponse.json({ members: rows });
}
