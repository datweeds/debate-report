import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { tq } from '@/lib/db';
import { isCustomerAdmin } from '@/lib/roles';

const TENANT_ID = parseInt(process.env.TENANT_ID ?? '1', 10);
type Params = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (!session.isSysAdmin && !await isCustomerAdmin(session.sub, TENANT_ID)) {
    return NextResponse.json({ error: 'CustomerAdmin required' }, { status: 403 });
  }

  const { id, userId } = await params;
  const { rowCount } = await tq(
    `DELETE FROM tenant_user_group_members
     WHERE group_id = $1 AND user_id = $2::uuid
       AND group_id IN (SELECT id FROM tenant_user_groups WHERE tenant_id = $3)`,
    [id, userId, TENANT_ID]
  );
  if (!rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
