import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

const TENANT_ID = process.env.TENANT_ID ?? '1';

async function getScotparlForum(): Promise<string | null> {
  const { rows: [f] } = await pool.query(
    `SELECT id FROM debate_forums WHERE is_system_forum = true AND forum_title = 'ScotParl Debates' LIMIT 1`
  );
  return f?.id ?? null;
}

async function createDebate(
  entityType: string,
  entityId: number,
  title: string,
  description: string,
  forumId: string,
  actorId: string
): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.tenant_id = ${parseInt(TENANT_ID, 10)}`);

    const { rows: [stmt] } = await client.query(
      `INSERT INTO statements
         (stat_type, stat_title, stat_description, subject_area, forum_visibility, forum_id, created_by)
       VALUES ('resolution', $1, $2, 'politics', 'public', $3, $4::uuid)
       RETURNING id`,
      [title, description, forumId, actorId]
    );

    if (entityType === 'bill') {
      await client.query(
        `INSERT INTO sp_bill_debates (sp_bill_id, resolution_id, created_by)
         VALUES ($1, $2, $3::uuid) ON CONFLICT DO NOTHING`,
        [entityId, stmt.id, actorId]
      );
    } else if (entityType === 'principle') {
      await client.query(
        `INSERT INTO nsp_principle_debates (principle_id, resolution_id, created_by)
         VALUES ($1, $2, $3::uuid) ON CONFLICT DO NOTHING`,
        [entityId, stmt.id, actorId]
      );
    } else {
      await client.query(
        `INSERT INTO sp_proposal_debates (proposal_id, resolution_id, created_by)
         VALUES ($1, $2, $3::uuid) ON CONFLICT DO NOTHING`,
        [entityId, stmt.id, actorId]
      );
    }

    await client.query('COMMIT');
    return stmt.id as string;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { canManageDebates } = await import('@/lib/roles');
  if (!await canManageDebates(session, parseInt(TENANT_ID, 10))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { action } = body;

  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = ${parseInt(TENANT_ID, 10)}`);

    const { rows: [r] } = await client.query(`SELECT * FROM sp_debate_requests WHERE id = $1`, [id]);
    if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (r.status !== 'pending') return NextResponse.json({ error: 'Request already actioned' }, { status: 409 });

    if (action === 'reject') {
      const { note } = body;
      await client.query(`UPDATE sp_debate_requests SET status = 'rejected' WHERE id = $1`, [id]);
      await client.query(
        `INSERT INTO sp_debate_request_actions (request_id, action, actor_id, actor_handle, note)
         VALUES ($1, 'rejected', $2, $3, $4)`,
        [id, session.sub, session.handle, note?.trim() || null]
      );
      return NextResponse.json({ ok: true });

    } else if (action === 'move_to_debate') {
      const { debate_title, debate_description } = body;
      if (!debate_title?.trim() || !debate_description?.trim()) {
        return NextResponse.json({ error: 'debate_title and debate_description required' }, { status: 400 });
      }

      const forumId = await getScotparlForum();
      if (!forumId) return NextResponse.json({ error: 'ScotParl forum not found — run migration 023' }, { status: 503 });

      const resolutionId = await createDebate(
        r.entity_type, r.entity_id,
        debate_title.trim(), debate_description.trim(),
        forumId, session.sub
      );

      await client.query(`UPDATE sp_debate_requests SET status = 'moved' WHERE id = $1`, [id]);
      await client.query(
        `INSERT INTO sp_debate_request_actions (request_id, action, actor_id, actor_handle, resolution_id)
         VALUES ($1, 'moved_to_debate', $2, $3, $4)`,
        [id, session.sub, session.handle, resolutionId]
      );

      return NextResponse.json({ ok: true, resolution_id: resolutionId });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } finally {
    client.release();
  }
}
