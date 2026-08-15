import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { isCustomerAdmin } from '@/lib/roles';

const TENANT_ID = parseInt(process.env.TENANT_ID ?? '1', 10);

type Params = { params: Promise<{ userId: string; topicId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { userId, topicId } = await params;

  // A TopicOwner can only update their own strapline
  const isOwn = session.sub === userId;
  const canManage = session.isSysAdmin || await isCustomerAdmin(session.sub, TENANT_ID) || isOwn;
  if (!canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // TopicOwners can only update strapline; CustomerAdmin/SysAdmin can update anything
  const { strapline } = await req.json();

  await pool.query(
    `UPDATE topic_owners SET strapline = $1 WHERE user_id = $2 AND topic_id = $3 AND tenant_id = $4`,
    [strapline?.trim() ?? null, userId, topicId, TENANT_ID]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (!session.isSysAdmin && !await isCustomerAdmin(session.sub, TENANT_ID)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId, topicId } = await params;
  await pool.query(
    `DELETE FROM topic_owners WHERE user_id = $1 AND topic_id = $2 AND tenant_id = $3`,
    [userId, topicId, TENANT_ID]
  );
  return NextResponse.json({ ok: true });
}
