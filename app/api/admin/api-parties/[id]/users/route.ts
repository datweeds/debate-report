import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;

  const { rows } = await pool.query(
    `SELECT apu.external_user_id, apu.created_at,
            u.id AS user_id, u.user_handle, u.user_full_name,
            COUNT(s.id)::int AS statement_count
     FROM   api_party_users apu
     JOIN   users u ON u.id = apu.user_id
     LEFT   JOIN statements s ON s.created_by = u.id
     WHERE  apu.api_party_id = $1
     GROUP  BY apu.external_user_id, apu.created_at, u.id, u.user_handle, u.user_full_name
     ORDER  BY apu.created_at ASC`,
    [id],
  );
  return NextResponse.json({ users: rows });
}
