import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { discussionAccess, REACTIONS, UUID_RE } from '@/lib/discussions';

type Params = { params: Promise<{ id: string; postId: string }> };

// POST { emoji } — toggle this user's reaction on a post.
export async function POST(req: NextRequest, { params }: Params) {
  const { id, postId } = await params;
  const a = await discussionAccess(req, id);
  if (!a || !UUID_RE.test(postId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canPost) return NextResponse.json({ error: 'Join this Society to react' }, { status: 403 });
  const { emoji } = await req.json().catch(() => ({}));
  if (!REACTIONS.includes(emoji)) return NextResponse.json({ error: 'Unknown reaction' }, { status: 400 });
  const { rows } = await pool.query(
    `SELECT 1 FROM discussion_posts p JOIN discussion_threads t ON t.id = p.thread_id
     WHERE p.id = $1 AND t.customer_id = $2 AND p.deleted_at IS NULL`,
    [postId, a.societyId],
  );
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const del = await pool.query(
    'DELETE FROM discussion_reactions WHERE post_id = $1 AND user_id = $2 AND emoji = $3',
    [postId, a.session!.sub, emoji],
  );
  if (!del.rowCount) {
    await pool.query('INSERT INTO discussion_reactions (post_id, user_id, emoji) VALUES ($1, $2, $3)', [postId, a.session!.sub, emoji]);
  }
  return NextResponse.json({ reacted: !del.rowCount });
}
