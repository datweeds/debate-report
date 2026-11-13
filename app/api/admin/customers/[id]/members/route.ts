import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// Membership for a PRIVATE society — who can see/switch to it (listed under
// "Private Societies" in the nav). Public societies need no membership.
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const { rows } = await pool.query(
    `SELECT cm.user_id, u.user_handle AS handle, cm.joined_at AS created_at
     FROM customer_members cm
     JOIN users u ON u.id::text = cm.user_id
     WHERE cm.customer_id = $1
     ORDER BY cm.joined_at ASC`,
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

  const { rows: [user] } = await pool.query('SELECT id FROM users WHERE user_handle = $1', [handle.trim()]);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  await pool.query(
    `INSERT INTO customer_members (customer_id, user_id) VALUES ($1, $2)
     ON CONFLICT (customer_id, user_id) DO NOTHING`,
    [id, user.id]
  );

  return NextResponse.json({ ok: true });
}
