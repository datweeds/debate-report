import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { rows } = await pool.query(
    `SELECT cr.user_id, u.user_handle AS handle, cr.created_at
     FROM customer_roles cr
     JOIN users u ON u.id::text = cr.user_id
     WHERE cr.tenant_id = $1 AND cr.role = 'customer_admin'
     ORDER BY cr.created_at ASC`,
    [id]
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const { handle } = await req.json();
  if (!handle?.trim()) return NextResponse.json({ error: 'handle is required' }, { status: 400 });

  const { rows: [user] } = await pool.query(
    `SELECT id FROM users WHERE user_handle = $1`,
    [handle.trim()]
  );
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  await pool.query(
    `INSERT INTO customer_roles (user_id, tenant_id, role)
     VALUES ($1, $2, 'customer_admin')
     ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = 'customer_admin'`,
    [user.id, id]
  );

  return NextResponse.json({ ok: true });
}
