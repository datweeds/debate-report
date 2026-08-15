import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

const TENANT_ID = parseInt(process.env.TENANT_ID ?? '1', 10);

type Params = { params: Promise<{ topicId: string }> };

// Allows a TopicOwner to update their own strapline without knowing their userId
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { topicId } = await params;
  const { strapline } = await req.json();

  const { rowCount } = await pool.query(
    `UPDATE topic_owners SET strapline = $1
     WHERE user_id = $2 AND topic_id = $3 AND tenant_id = $4`,
    [strapline?.trim() ?? null, session.sub, topicId, TENANT_ID]
  );

  if (!rowCount) return NextResponse.json({ error: 'Not found or not owner' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
