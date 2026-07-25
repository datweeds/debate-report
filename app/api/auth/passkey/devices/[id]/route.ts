import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;

  // Only delete if it belongs to this user
  const result = await pool.query(
    `DELETE FROM passkeys WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, session.sub]
  );

  if (!result.rows.length) {
    return NextResponse.json({ error: 'Passkey not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
