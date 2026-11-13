import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// Transactional so the "exactly one default" invariant can never be violated
// by two concurrent requests racing a plain two-step UPDATE.
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const { rows: [society] } = await pool.query('SELECT id, is_public FROM customers WHERE id = $1', [id]);
  if (!society) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!society.is_public) {
    return NextResponse.json({ error: 'The default society must be public — logged-out visitors can\'t see a private one' }, { status: 422 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE customers SET is_default = false WHERE is_default = true');
    await client.query('UPDATE customers SET is_default = true WHERE id = $1', [id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return NextResponse.json({ ok: true });
}
