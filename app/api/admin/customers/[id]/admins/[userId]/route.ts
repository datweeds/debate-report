import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, userId } = await params;
  await pool.query(
    `DELETE FROM customer_roles WHERE user_id = $1 AND tenant_id = $2 AND role = 'customer_admin'`,
    [userId, id]
  );
  return NextResponse.json({ ok: true });
}
