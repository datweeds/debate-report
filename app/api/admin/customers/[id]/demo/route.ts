import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { isUnlocked } from '@/lib/masterKey';
import { reencryptSociety } from '@/lib/societyRekey';
import { forgetSociety } from '@/lib/societyCrypto';

type Params = { params: Promise<{ id: string }> };

// POST { demo: boolean } — SysAdmin makes this Society the demo (or stops it
// being one). The demo is public, with every debate public, so its stored
// content is decrypted to match. Only one Society can be the demo.
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = Number((await params).id);
  const { demo } = await req.json().catch(() => ({}));
  const { rows: [society] } = await pool.query('SELECT id FROM customers WHERE id = $1', [id]);
  if (!society) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (demo !== true) {
    await pool.query('UPDATE customers SET is_demo = false WHERE id = $1', [id]);
    return NextResponse.json({ ok: true });
  }
  if (!isUnlocked()) return NextResponse.json({ error: 'Private content is locked just now, so it can’t be made public. Please try again shortly.' }, { status: 503 });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE customers SET is_demo = false WHERE is_demo');
    await client.query(`UPDATE customers SET is_demo = true, visibility = 'public', updated_at = now() WHERE id = $1`, [id]);
    await client.query(`UPDATE statements SET debate_visibility = 'public' WHERE customer_id = $1 AND stat_type = 'resolution'`, [id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  // Now public: bring its stored content in line (poll ballots stay encrypted)
  forgetSociety(id);
  const changed = await reencryptSociety(id);
  return NextResponse.json({ ok: true, decrypted: changed });
}
