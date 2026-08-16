import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { tq } from '@/lib/db';
import { isCustomerAdmin, canManageDebates } from '@/lib/roles';

const TENANT_ID = parseInt(process.env.TENANT_ID ?? '1', 10);
type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (!await canManageDebates(session, TENANT_ID)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const { rows: [group] } = await tq(
    `SELECT id, name, description, created_at FROM tenant_user_groups WHERE id = $1 AND tenant_id = $2`,
    [id, TENANT_ID]
  );
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { rows: members } = await tq(
    `SELECT u.id, u.user_handle AS handle, u.user_full_name AS name, m.added_at
     FROM tenant_user_group_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.group_id = $1
     ORDER BY u.user_handle`,
    [id]
  );

  return NextResponse.json({ group, members });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (!session.isSysAdmin && !await isCustomerAdmin(session.sub, TENANT_ID)) {
    return NextResponse.json({ error: 'CustomerAdmin required' }, { status: 403 });
  }

  const { id } = await params;
  const { name, description } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const { rowCount } = await tq(
    `UPDATE tenant_user_groups SET name = $1, description = $2
     WHERE id = $3 AND tenant_id = $4`,
    [name.trim(), description?.trim() ?? null, id, TENANT_ID]
  );
  if (!rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (!session.isSysAdmin && !await isCustomerAdmin(session.sub, TENANT_ID)) {
    return NextResponse.json({ error: 'CustomerAdmin required' }, { status: 403 });
  }

  const { id } = await params;
  const { rowCount } = await tq(
    `DELETE FROM tenant_user_groups WHERE id = $1 AND tenant_id = $2`,
    [id, TENANT_ID]
  );
  if (!rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
