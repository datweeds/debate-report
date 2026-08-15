import { NextRequest, NextResponse } from 'next/server';
import { tq } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get('entity_type');
  const entityId   = searchParams.get('entity_id');
  if (!entityType || !entityId) {
    return NextResponse.json({ error: 'entity_type and entity_id required' }, { status: 400 });
  }

  let rows;
  if (session.isSysAdmin) {
    // SysAdmins see all requests + action history
    ({ rows } = await tq(
      `SELECT r.id, r.requester_id, r.requester_handle, r.reason, r.status, r.created_at,
              json_agg(
                json_build_object('action', a.action, 'actor_handle', a.actor_handle,
                                  'note', a.note, 'resolution_id', a.resolution_id, 'created_at', a.created_at)
                ORDER BY a.created_at
              ) FILTER (WHERE a.id IS NOT NULL) AS history
       FROM sp_debate_requests r
       LEFT JOIN sp_debate_request_actions a ON a.request_id = r.id
       WHERE r.entity_type = $1 AND r.entity_id = $2
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
      [entityType, entityId]
    ));
  } else {
    // Users see only their own requests
    ({ rows } = await tq(
      `SELECT r.id, r.reason, r.status, r.created_at
       FROM sp_debate_requests r
       WHERE r.entity_type = $1 AND r.entity_id = $2 AND r.requester_id = $3
       ORDER BY r.created_at DESC`,
      [entityType, entityId, session.sub]
    ));
  }

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (session.isSysAdmin) return NextResponse.json({ error: 'Use direct open for sysadmin' }, { status: 400 });

  const { entity_type, entity_id, reason } = await req.json();
  if (!['bill', 'proposal', 'principle'].includes(entity_type)) {
    return NextResponse.json({ error: 'Invalid entity_type' }, { status: 400 });
  }
  if (!entity_id || !reason?.trim()) {
    return NextResponse.json({ error: 'entity_id and reason are required' }, { status: 400 });
  }

  // Check for existing pending request from this user
  const { rows: [existing] } = await tq(
    `SELECT id FROM sp_debate_requests
     WHERE entity_type = $1 AND entity_id = $2 AND requester_id = $3 AND status = 'pending'`,
    [entity_type, entity_id, session.sub]
  );
  if (existing) return NextResponse.json({ error: 'You already have a pending request' }, { status: 409 });

  const { rows: [r] } = await tq(
    `INSERT INTO sp_debate_requests (entity_type, entity_id, requester_id, requester_handle, reason)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [entity_type, entity_id, session.sub, session.handle, reason.trim()]
  );

  await tq(
    `INSERT INTO sp_debate_request_actions (request_id, action, actor_id, actor_handle)
     VALUES ($1, 'requested', $2, $3)`,
    [r.id, session.sub, session.handle]
  );

  return NextResponse.json({ id: r.id }, { status: 201 });
}
