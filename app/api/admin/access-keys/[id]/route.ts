import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f-]{36}$/i;

// PATCH { action: 'revoke' } — the key stops working at once (kept for the record).
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { action } = await req.json();
  if (action !== 'revoke') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  const { rowCount } = await pool.query(
    'UPDATE access_keys SET revoked_at = COALESCE(revoked_at, now()) WHERE id = $1',
    [id],
  );
  if (!rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// DELETE — removes the key and its record entirely.
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await pool.query('DELETE FROM access_keys WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}
