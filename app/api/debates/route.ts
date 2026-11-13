import { NextRequest, NextResponse } from 'next/server';
import pool, { getCurrentTenantId } from '@/lib/db';
import { getSession } from '@/lib/auth';

const ALLOWED_TIERS = new Set(['moderator', 'sysadmin']);

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (!ALLOWED_TIERS.has(session.tier)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { rows } = await pool.query(
    `SELECT s.id, s.stat_title, s.stat_description, s.subject_area,
            s.forum_visibility, s.image_path, s.created_at,
            s.stat_status, s.resolution_decision,
            s.vote_total_for, s.vote_total_against,
            s.created_by, s.customer_id,
            u.user_handle AS creator_handle,
            c.name AS society_name,
            COUNT(ch.id)::int AS child_count
     FROM   statements s
     LEFT   JOIN users u ON u.id = s.created_by
     LEFT   JOIN customers c ON c.id = s.customer_id
     LEFT   JOIN statements ch ON ch.resolution_id = s.id
     WHERE  s.stat_type = 'resolution'
       AND  s.stat_status != 'deleted'
     GROUP  BY s.id, u.user_handle, c.name
     ORDER  BY s.created_at DESC`
  );

  return NextResponse.json(rows);
}

const VALID_SUBJECTS = new Set([
  'culture', 'economics', 'education', 'environment', 'future',
  'health', 'history', 'law', 'media', 'philosophy', 'politics', 'science',
]);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (!ALLOWED_TIERS.has(session.tier)) {
    return NextResponse.json({ error: 'Only moderators can create debates' }, { status: 403 });
  }

  const { title, description, subjectArea } = await req.json();

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Resolution title is required' }, { status: 400 });
  }
  if (title.trim().length > 500) {
    return NextResponse.json({ error: 'Title must be 500 characters or fewer' }, { status: 400 });
  }
  if (!subjectArea || !VALID_SUBJECTS.has(subjectArea)) {
    return NextResponse.json({ error: 'Please select a valid topic' }, { status: 400 });
  }

  const customerId = await getCurrentTenantId();
  const { rows } = await pool.query(
    `INSERT INTO statements
       (stat_type, stat_title, stat_description, subject_area, forum_visibility, created_by, customer_id)
     VALUES ('resolution', $1, $2, $3, 'public', $4, $5)
     RETURNING id`,
    [title.trim(), description?.trim() || null, subjectArea, session.sub, customerId]
  );

  return NextResponse.json({ id: rows[0].id }, { status: 201 });
}
