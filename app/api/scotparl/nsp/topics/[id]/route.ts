import { NextRequest, NextResponse } from 'next/server';
import { tq } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { isCustomerAdmin } from '@/lib/roles';

const TENANT_ID = parseInt(process.env.TENANT_ID ?? '1', 10);

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const canAdmin = session.isSysAdmin || await isCustomerAdmin(session.sub, TENANT_ID);
  if (!canAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const { name, description } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  await tq(
    `UPDATE nsp_topics SET name = $1, description = $2 WHERE id = $3`,
    [name.trim(), description?.trim() || null, id]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const canAdmin = session.isSysAdmin || await isCustomerAdmin(session.sub, TENANT_ID);
  if (!canAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  await tq(`DELETE FROM nsp_topics WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
