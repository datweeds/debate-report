import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { generateApiToken, hashApiToken } from '@/lib/apiParties';

export async function GET() {
  const session = await getSession();
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.max_users, p.created_at, p.revoked_at,
            COUNT(u.id)::int AS registered_users
     FROM   api_parties p
     LEFT   JOIN api_party_users u ON u.api_party_id = p.id
     GROUP  BY p.id
     ORDER  BY p.created_at DESC`,
  );
  return NextResponse.json({ parties: rows });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, max_users } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  const maxUsers = Number(max_users) || 10;
  if (maxUsers < 1 || maxUsers > 1000) return NextResponse.json({ error: 'max_users must be between 1 and 1000' }, { status: 400 });

  const token = generateApiToken();
  const { rows: [party] } = await pool.query(
    `INSERT INTO api_parties (name, token_hash, max_users, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, max_users, created_at`,
    [name.trim(), hashApiToken(token), maxUsers, session.sub],
  );

  // The raw token is only ever returned here — it's not retrievable again.
  return NextResponse.json({ party, token }, { status: 201 });
}
