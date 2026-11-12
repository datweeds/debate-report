import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// PATCH { revoked: true | false } — revoke or (if ever needed) un-revoke a party's token.
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const { revoked } = await req.json();

  const { rows } = await pool.query(
    `UPDATE api_parties SET revoked_at = $2 WHERE id = $1
     RETURNING id, name, max_users, created_at, revoked_at`,
    [id, revoked ? new Date().toISOString() : null],
  );
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ party: rows[0] });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  await pool.query('DELETE FROM api_parties WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}
