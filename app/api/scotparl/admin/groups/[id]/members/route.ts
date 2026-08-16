import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { tq } from '@/lib/db';
import { isCustomerAdmin } from '@/lib/roles';

const TENANT_ID = parseInt(process.env.TENANT_ID ?? '1', 10);
type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (!session.isSysAdmin && !await isCustomerAdmin(session.sub, TENANT_ID)) {
    return NextResponse.json({ error: 'CustomerAdmin required' }, { status: 403 });
  }

  const { id } = await params;
  const { handle } = await req.json();
  if (!handle?.trim()) return NextResponse.json({ error: 'handle required' }, { status: 400 });

  const { rows: [user] } = await tq(
    `SELECT id, user_handle FROM users WHERE LOWER(user_handle) = LOWER($1) LIMIT 1`,
    [handle.trim()]
  );
  if (!user) return NextResponse.json({ error: `No user found with handle @${handle}` }, { status: 404 });

  const { rows: [group] } = await tq(
    `SELECT id FROM tenant_user_groups WHERE id = $1 AND tenant_id = $2`,
    [id, TENANT_ID]
  );
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  try {
    await tq(
      `INSERT INTO tenant_user_group_members (group_id, user_id, added_by)
       VALUES ($1, $2::uuid, $3::uuid) ON CONFLICT DO NOTHING`,
      [id, user.id, session.sub]
    );
    return NextResponse.json({ ok: true, user: { id: user.id, handle: user.user_handle } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
