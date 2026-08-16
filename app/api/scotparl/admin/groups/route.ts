import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { tq } from '@/lib/db';
import { isCustomerAdmin, canManageDebates } from '@/lib/roles';

const TENANT_ID = parseInt(process.env.TENANT_ID ?? '1', 10);

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (!await canManageDebates(session, TENANT_ID)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { rows } = await tq(
    `SELECT g.id, g.name, g.description, g.created_at,
            COUNT(m.user_id)::int AS member_count
     FROM tenant_user_groups g
     LEFT JOIN tenant_user_group_members m ON m.group_id = g.id
     WHERE g.tenant_id = $1
     GROUP BY g.id ORDER BY g.name`,
    [TENANT_ID]
  );
  return NextResponse.json({ groups: rows });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (!session.isSysAdmin && !await isCustomerAdmin(session.sub, TENANT_ID)) {
    return NextResponse.json({ error: 'CustomerAdmin required' }, { status: 403 });
  }

  const { name, description } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

  try {
    const { rows: [g] } = await tq(
      `INSERT INTO tenant_user_groups (tenant_id, name, description, created_by)
       VALUES ($1, $2, $3, $4::uuid) RETURNING id, name, description`,
      [TENANT_ID, name.trim(), description?.trim() ?? null, session.sub]
    );
    return NextResponse.json(g, { status: 201 });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === '23505') return NextResponse.json({ error: 'A group with that name already exists' }, { status: 409 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
