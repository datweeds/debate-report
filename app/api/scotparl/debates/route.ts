// SysAdmin direct debate creation (no prior request needed)
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

const TENANT_ID = process.env.TENANT_ID ?? '1';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { canManageDebates } = await import('@/lib/roles');
  if (!await canManageDebates(session, parseInt(TENANT_ID, 10))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { entity_type, entity_id, debate_title, debate_description } = await req.json();

  if (!['bill', 'proposal', 'principle'].includes(entity_type) || !entity_id) {
    return NextResponse.json({ error: 'Invalid entity_type or entity_id' }, { status: 400 });
  }
  if (!debate_title?.trim() || !debate_description?.trim()) {
    return NextResponse.json({ error: 'debate_title and debate_description required' }, { status: 400 });
  }

  const { rows: [forum] } = await pool.query(
    `SELECT id FROM debate_forums WHERE is_system_forum = true AND forum_title = 'ScotParl Debates' LIMIT 1`
  );
  if (!forum) return NextResponse.json({ error: 'ScotParl forum not found — run migration 023' }, { status: 503 });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.tenant_id = ${parseInt(TENANT_ID, 10)}`);

    const { rows: [stmt] } = await client.query(
      `INSERT INTO statements
         (stat_type, stat_title, stat_description, subject_area, forum_visibility, forum_id, created_by)
       VALUES ('resolution', $1, $2, 'politics', 'public', $3, $4::uuid)
       RETURNING id`,
      [debate_title.trim(), debate_description.trim(), forum.id, session.sub]
    );

    if (entity_type === 'bill') {
      await client.query(
        `INSERT INTO sp_bill_debates (sp_bill_id, resolution_id, created_by)
         VALUES ($1, $2, $3::uuid) ON CONFLICT DO NOTHING`,
        [entity_id, stmt.id, session.sub]
      );
    } else if (entity_type === 'principle') {
      await client.query(
        `INSERT INTO nsp_principle_debates (principle_id, resolution_id, created_by)
         VALUES ($1, $2, $3::uuid) ON CONFLICT DO NOTHING`,
        [entity_id, stmt.id, session.sub]
      );
    } else {
      await client.query(
        `INSERT INTO sp_proposal_debates (proposal_id, resolution_id, created_by)
         VALUES ($1, $2, $3::uuid) ON CONFLICT DO NOTHING`,
        [entity_id, stmt.id, session.sub]
      );
    }

    // Record a direct_open action (no linked request)
    await client.query(
      `INSERT INTO sp_debate_request_actions (request_id, action, actor_id, actor_handle, resolution_id)
       VALUES (NULL, 'direct_open', $1, $2, $3)`,
      [session.sub, session.handle, stmt.id]
    );

    await client.query('COMMIT');
    return NextResponse.json({ resolution_id: stmt.id }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: String(err) }, { status: 500 });
  } finally {
    client.release();
  }
}
