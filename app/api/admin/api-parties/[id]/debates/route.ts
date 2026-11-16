import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { openForSysAdmin } from '@/lib/debateCrypto';

type Params = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f-]{36}$/i;

// GET — every private (Apply/Invite) debate, flagged with whether this party is granted it.
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { rows } = await pool.query(
    `SELECT r.id, r.stat_title AS title, r.debate_visibility AS visibility, c.name AS society, r.customer_id AS society_id,
            (g.resolution_id IS NOT NULL) AS granted
     FROM   statements r
     LEFT   JOIN customers c ON c.id = r.customer_id
     LEFT   JOIN api_party_debates g ON g.resolution_id = r.id AND g.api_party_id = $1
     WHERE  r.stat_type = 'resolution' AND (r.debate_visibility <> 'public' OR COALESCE(c.visibility, 'public') <> 'public')
     ORDER  BY c.name NULLS LAST, r.created_at`,
    [id],
  );
  await openForSysAdmin(session, rows, r => r.society_id);
  return NextResponse.json({ debates: rows });
}

// PUT { resolutionIds: string[] } — replaces this party's private-debate grants.
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { resolutionIds } = await req.json().catch(() => ({}));
  if (!Array.isArray(resolutionIds) || !resolutionIds.every(r => typeof r === 'string' && UUID.test(r))) {
    return NextResponse.json({ error: 'resolutionIds must be a list of debate IDs' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM api_party_debates WHERE api_party_id = $1', [id]);
    await client.query(
      `INSERT INTO api_party_debates (api_party_id, resolution_id)
       SELECT $1, r.id FROM statements r
       WHERE  r.id = ANY($2::uuid[]) AND r.stat_type = 'resolution'`,
      [id, resolutionIds],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('api-party debates PUT failed:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  } finally {
    client.release();
  }
  return NextResponse.json({ ok: true });
}
