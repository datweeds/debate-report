import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/forums — list forums owned by the current user
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { rows } = await pool.query(
    `SELECT f.id, f.forum_title, f.forum_description, f.forum_type,
            f.forum_visibility, f.forum_status, f.is_system_forum,
            f.created_at, f.updated_at,
            COUNT(DISTINCT fm.user_id)::int AS member_count,
            COUNT(DISTINCT s.id)::int       AS debate_count
     FROM   debate_forums f
     LEFT   JOIN forum_members fm ON fm.forum_id = f.id AND fm.member_status = 'active'
     LEFT   JOIN statements s ON s.forum_id = f.id AND s.stat_type = 'resolution'
                              AND s.stat_status = 'active'
     WHERE  f.forum_owner = $1 AND f.forum_status != 'deleted'
     GROUP  BY f.id
     ORDER  BY f.is_system_forum DESC, f.created_at ASC`,
    [session.sub]
  );

  return NextResponse.json(rows);
}

// POST /api/forums — create a new private forum (paid users only)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (session.plan !== 'paid' && !session.isSysAdmin) {
    return NextResponse.json({ error: 'Paid plan required to create additional forums' }, { status: 403 });
  }

  const { title, description, visibility } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  if (!['invite', 'apply'].includes(visibility)) {
    return NextResponse.json({ error: 'Visibility must be invite or apply' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [forum] } = await client.query(
      `INSERT INTO debate_forums
         (created_by, forum_owner, forum_title, forum_description, forum_type, forum_visibility, forum_status, is_system_forum)
       VALUES ($1, $1, $2, $3, 'private', $4, 'active', FALSE)
       RETURNING id, forum_title, forum_description, forum_type, forum_visibility, forum_status, is_system_forum, created_at`,
      [session.sub, title.trim(), description?.trim() ?? null, visibility]
    );
    // Add owner as active member
    await client.query(
      `INSERT INTO forum_members (forum_id, user_id, member_role, member_status)
       VALUES ($1, $2, 'debater', 'active')`,
      [forum.id, session.sub]
    );
    await client.query('COMMIT');
    return NextResponse.json(forum, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Forum create error:', err);
    return NextResponse.json({ error: 'Failed to create forum' }, { status: 500 });
  } finally {
    client.release();
  }
}
