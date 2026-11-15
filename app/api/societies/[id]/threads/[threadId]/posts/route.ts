import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { discussionAccess, UUID_RE } from '@/lib/discussions';

type Params = { params: Promise<{ id: string; threadId: string }> };

// POST { body, replyTo? } — post in a thread, optionally replying to a post.
export async function POST(req: NextRequest, { params }: Params) {
  const { id, threadId } = await params;
  const a = await discussionAccess(req, id);
  if (!a || !UUID_RE.test(threadId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { rows: [t] } = await pool.query(
    'SELECT locked FROM discussion_threads WHERE id = $1 AND customer_id = $2 AND deleted_at IS NULL',
    [threadId, a.societyId],
  );
  if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canPost) return NextResponse.json({ error: 'Join this Society to take part' }, { status: 403 });
  if (t.locked) return NextResponse.json({ error: 'This discussion is locked' }, { status: 403 });

  const { body, replyTo } = await req.json().catch(() => ({}));
  if (typeof body !== 'string' || !body.trim()) return NextResponse.json({ error: 'Message is empty' }, { status: 400 });
  if (body.length > 5000) return NextResponse.json({ error: 'Message must be 5,000 characters or fewer' }, { status: 400 });
  let reply: string | null = null;
  if (typeof replyTo === 'string' && UUID_RE.test(replyTo)) {
    const { rows } = await pool.query('SELECT 1 FROM discussion_posts WHERE id = $1 AND thread_id = $2', [replyTo, threadId]);
    if (rows.length) reply = replyTo;
  }
  const { rows: [p] } = await pool.query(
    `INSERT INTO discussion_posts (thread_id, reply_to, body, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
    [threadId, reply, body.trim(), a.session!.sub],
  );
  await pool.query('UPDATE discussion_threads SET last_post_at = now() WHERE id = $1', [threadId]);
  return NextResponse.json({ id: p.id }, { status: 201 });
}
