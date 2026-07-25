import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

const ALLOWED_TIERS = new Set(['moderator', 'sysadmin']);

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

  const { rows } = await pool.query(
    `INSERT INTO statements
       (stat_type, stat_title, stat_description, subject_area, forum_visibility, created_by)
     VALUES ('resolution', $1, $2, $3, 'public', $4)
     RETURNING id`,
    [title.trim(), description?.trim() || null, subjectArea, session.sub]
  );

  return NextResponse.json({ id: rows[0].id }, { status: 201 });
}
