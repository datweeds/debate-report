import { NextRequest, NextResponse } from 'next/server';
import pool, { getCurrentTenantId } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { moderatedSocietyIds } from '@/lib/roles';
import { sealText } from '@/lib/societyCrypto';
import { openDeep } from '@/lib/societyCrypto';


export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  // Manage Debates: only debates in Societies this user moderates
  const mine = await moderatedSocietyIds(session.sub);
  const { rows } = await pool.query(
    `SELECT s.id, s.stat_title, s.stat_description, s.subject_area,
            s.debate_visibility, s.image_path, s.created_at,
            s.stat_status, s.resolution_decision,
            s.vote_total_for, s.vote_total_against,
            s.created_by, s.customer_id,
            u.user_handle AS creator_handle,
            c.name AS society_name, c.is_public AS society_is_public,
            COUNT(ch.id)::int AS child_count
     FROM   statements s
     LEFT   JOIN users u ON u.id = s.created_by
     LEFT   JOIN customers c ON c.id = s.customer_id
     LEFT   JOIN statements ch ON ch.resolution_id = s.id
     WHERE  s.stat_type = 'resolution'
       AND  s.stat_status != 'deleted'
       AND  s.customer_id = ANY($1::int[])
     GROUP  BY s.id, u.user_handle, c.name, c.is_public
     ORDER  BY s.created_at DESC`,
    [mine],
  );

  // Every listed debate is one this user moderates
  await openDeep(rows);
  return NextResponse.json(rows.map(r => ({ ...r, can_set_visibility: true })));
}

const VALID_SUBJECTS = new Set([
  'culture', 'economics', 'education', 'environment', 'future',
  'health', 'history', 'law', 'media', 'philosophy', 'politics', 'science',
]);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { title, description, subjectArea, societyId } = await req.json();

  // New debates go into a Society this user moderates: the one chosen, else the current one
  const mine = await moderatedSocietyIds(session.sub);
  const customerId = societyId != null ? Number(societyId) : await getCurrentTenantId();
  if (!mine.includes(customerId)) {
    return NextResponse.json({ error: 'Only a moderator of this Society can create debates in it' }, { status: 403 });
  }

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
       (stat_type, stat_title, stat_description, subject_area, created_by, customer_id)
     VALUES ('resolution', $1, $2, $3, $4, $5)
     RETURNING id`,
    [await sealText(customerId, title.trim()), await sealText(customerId, description?.trim() || null), subjectArea, session.sub, customerId]
  );

  return NextResponse.json({ id: rows[0].id }, { status: 201 });
}
