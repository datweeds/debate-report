import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// GET /api/forums/[id] — forum detail + members
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { rows: [forum] } = await pool.query(
    `SELECT f.id, f.forum_title, f.forum_description, f.forum_type,
            f.forum_visibility, f.forum_status, f.is_system_forum,
            f.created_at, f.updated_at
     FROM   debate_forums f
     WHERE  f.id = $1 AND f.forum_owner = $2 AND f.forum_status != 'deleted'`,
    [id, session.sub]
  );
  if (!forum) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { rows: members } = await pool.query(
    `SELECT fm.id, fm.user_id, fm.member_role, fm.member_status, fm.created_at,
            u.user_handle, u.user_full_name
     FROM   forum_members fm
     JOIN   users u ON u.id = fm.user_id
     WHERE  fm.forum_id = $1
     ORDER  BY fm.created_at ASC`,
    [id]
  );

  const { rows: invitations } = await pool.query(
    `SELECT id, invitee_email, invitation_status, created_at
     FROM   invitations
     WHERE  forum_id = $1
     ORDER  BY created_at DESC`,
    [id]
  );

  return NextResponse.json({ forum, members, invitations });
}

// PATCH /api/forums/[id] — update title, description, visibility
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { rows: [forum] } = await pool.query(
    `SELECT id, is_system_forum, forum_visibility
     FROM debate_forums WHERE id = $1 AND forum_owner = $2 AND forum_status != 'deleted'`,
    [id, session.sub]
  );
  if (!forum) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { title, description, visibility } = await req.json();
  if (title !== undefined && !title?.trim()) {
    return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
  }
  if (visibility !== undefined && !['invite', 'apply'].includes(visibility)) {
    return NextResponse.json({ error: 'Visibility must be invite or apply' }, { status: 400 });
  }
  // System forums are locked to invite visibility
  const newVisibility = forum.is_system_forum ? 'invite' : (visibility ?? forum.forum_visibility);

  const { rows: [updated] } = await pool.query(
    `UPDATE debate_forums
     SET forum_title       = COALESCE($1, forum_title),
         forum_description = COALESCE($2, forum_description),
         forum_visibility  = $3
     WHERE id = $4
     RETURNING id, forum_title, forum_description, forum_type, forum_visibility,
               forum_status, is_system_forum, created_at, updated_at`,
    [title?.trim() ?? null, description?.trim() ?? null, newVisibility, id]
  );
  return NextResponse.json(updated);
}

// DELETE /api/forums/[id] — soft-delete (system forums cannot be deleted)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { rows: [forum] } = await pool.query(
    `SELECT id, is_system_forum FROM debate_forums
     WHERE id = $1 AND forum_owner = $2 AND forum_status != 'deleted'`,
    [id, session.sub]
  );
  if (!forum) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (forum.is_system_forum) {
    return NextResponse.json({ error: 'Your personal forum cannot be deleted' }, { status: 403 });
  }

  await pool.query(
    `UPDATE debate_forums SET forum_status = 'deleted' WHERE id = $1`,
    [id]
  );
  return NextResponse.json({ ok: true });
}
