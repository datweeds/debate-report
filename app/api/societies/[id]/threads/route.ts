import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { discussionAccess } from '@/lib/discussions';

type Params = { params: Promise<{ id: string }> };

// GET — the Society's discussion threads, pinned first, then most recently active.
export async function GET(req: NextRequest, { params }: Params) {
  const a = await discussionAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { rows } = await pool.query(
    `SELECT t.id, t.title, t.created_at, t.last_post_at, t.pinned, t.locked,
            u.user_handle AS author,
            (SELECT COUNT(*)::int FROM discussion_posts p WHERE p.thread_id = t.id AND p.deleted_at IS NULL) AS post_count,
            (SELECT lu.user_handle FROM discussion_posts lp LEFT JOIN users lu ON lu.id = lp.created_by
             WHERE lp.thread_id = t.id AND lp.deleted_at IS NULL ORDER BY lp.created_at DESC LIMIT 1) AS last_author
     FROM discussion_threads t LEFT JOIN users u ON u.id = t.created_by
     WHERE t.customer_id = $1 AND t.deleted_at IS NULL
     ORDER BY t.pinned DESC, t.last_post_at DESC
     LIMIT 200`,
    [a.societyId],
  );
  return NextResponse.json({ threads: rows, canPost: a.canPost, canModerate: a.canModerate });
}

// POST { title, body } — start a discussion.
export async function POST(req: NextRequest, { params }: Params) {
  const a = await discussionAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canPost) return NextResponse.json({ error: 'Join this Society to start a discussion' }, { status: 403 });
  const { title, body } = await req.json().catch(() => ({}));
  if (typeof title !== 'string' || !title.trim()) return NextResponse.json({ error: 'A title is required' }, { status: 400 });
  if (typeof body !== 'string' || !body.trim()) return NextResponse.json({ error: 'Write something to start the discussion' }, { status: 400 });
  if (body.length > 5000) return NextResponse.json({ error: 'Message must be 5,000 characters or fewer' }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [t] } = await client.query(
      `INSERT INTO discussion_threads (customer_id, title, created_by) VALUES ($1, $2, $3) RETURNING id`,
      [a.societyId, title.trim().slice(0, 200), a.session!.sub],
    );
    await client.query(
      `INSERT INTO discussion_posts (thread_id, body, created_by) VALUES ($1, $2, $3)`,
      [t.id, body.trim(), a.session!.sub],
    );
    await client.query('COMMIT');
    return NextResponse.json({ id: t.id }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
