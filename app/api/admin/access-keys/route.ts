import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { generateAccessKey, hashAccessKey, DEFAULT_EXPIRY_DAYS } from '@/lib/accessKeys';
import { openForSysAdmin } from '@/lib/debateCrypto';

// SysAdmin: list and create Access Keys. (/api/admin/* is also SysAdmin-gated in proxy.ts.)

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { rows } = await pool.query(`
    SELECT k.id, k.label, k.created_at, k.expires_at, k.revoked_at,
           k.first_used_at, k.last_used_at, k.use_count,
           u.user_handle AS created_by_handle,
           COALESCE(json_agg(json_build_object('id', s.id, 'title', s.stat_title, 'society_id', s.customer_id)
                    ORDER BY s.created_at) FILTER (WHERE s.id IS NOT NULL), '[]') AS debates
    FROM access_keys k
    LEFT JOIN users u               ON u.id = k.created_by
    LEFT JOIN access_key_debates kd ON kd.key_id = k.id
    LEFT JOIN statements s          ON s.id = kd.resolution_id
    GROUP BY k.id, u.user_handle
    ORDER BY k.created_at DESC
  `);
  for (const k of rows) await openForSysAdmin(session, k.debates as { society_id: number | null }[], d => d.society_id);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  const resolutionIds: string[] = Array.isArray(body.resolutionIds) ? body.resolutionIds.filter((x: unknown) => typeof x === 'string') : [];
  // expiresInDays: a positive number, or null for no expiry; defaults to 30.
  const days = body.expiresInDays === null ? null
    : Number.isFinite(Number(body.expiresInDays)) && Number(body.expiresInDays) > 0 ? Number(body.expiresInDays)
    : DEFAULT_EXPIRY_DAYS;

  if (!label) return NextResponse.json({ error: 'Give the key a label (who it is for)' }, { status: 400 });
  if (!resolutionIds.length) return NextResponse.json({ error: 'Choose at least one debate' }, { status: 400 });

  const { rows: found } = await pool.query(
    `SELECT id FROM statements WHERE id = ANY($1::uuid[]) AND stat_type = 'resolution'`,
    [resolutionIds],
  );
  if (found.length !== new Set(resolutionIds).size) {
    return NextResponse.json({ error: 'One or more debates were not found' }, { status: 400 });
  }

  const raw = generateAccessKey();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [key] } = await client.query(
      `INSERT INTO access_keys (key_hash, label, created_by, expires_at)
       VALUES ($1, $2, $3, CASE WHEN $4::numeric IS NULL THEN NULL ELSE now() + make_interval(days => $4::int) END)
       RETURNING id, expires_at`,
      [hashAccessKey(raw), label, session.sub, days],
    );
    await client.query(
      `INSERT INTO access_key_debates (key_id, resolution_id) SELECT $1, unnest($2::uuid[])`,
      [key.id, found.map(r => r.id)],
    );
    await client.query('COMMIT');
    // The raw key is returned this once and never stored.
    return NextResponse.json({ id: key.id, expiresAt: key.expires_at, path: `/key/${raw}` }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
