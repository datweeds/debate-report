import { NextRequest, NextResponse } from 'next/server';
import { notifyNew } from '@/lib/notify';
import pool from '@/lib/db';
import { sealText } from '@/lib/societyCrypto';
import { discussionAccess, UUID_RE } from '@/lib/discussions';
import { lockSafe } from '@/lib/lockSafe';
import { threadText } from '@/lib/sealed/server';

type Params = { params: Promise<{ id: string; threadId: string }> };

// POST { body, replyTo? } — post in a thread, optionally replying to a post.
async function handlePOST(req: NextRequest, { params }: Params) {
  const { id, threadId } = await params;
  const a = await discussionAccess(req, id);
  if (!a || !UUID_RE.test(threadId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { rows: [t] } = await pool.query(
    'SELECT locked FROM discussion_threads WHERE id = $1 AND customer_id = $2 AND deleted_at IS NULL',
    [threadId, a.societyId],
  );
  if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canPost || (!a.isMember && !a.canModerate)) return NextResponse.json({ error: 'Join this Society to take part' }, { status: 403 });
  if (t.locked) return NextResponse.json({ error: 'This discussion is locked' }, { status: 403 });

  const { body, replyTo } = await req.json().catch(() => ({}));
  const msg = await threadText(a.societyId, threadId, body, 5000, 'Message');
  if ('error' in msg) return NextResponse.json({ error: msg.error }, { status: 400 });
  let reply: string | null = null;
  if (typeof replyTo === 'string' && UUID_RE.test(replyTo)) {
    const { rows } = await pool.query('SELECT 1 FROM discussion_posts WHERE id = $1 AND thread_id = $2', [replyTo, threadId]);
    if (rows.length) reply = replyTo;
  }
  const { rows: [p] } = await pool.query(
    `INSERT INTO discussion_posts (thread_id, reply_to, body, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
    [threadId, reply, msg.sealed ? msg.text : await sealText(a.societyId, msg.text, true), a.session!.sub],
  );
  await pool.query('UPDATE discussion_threads SET last_post_at = now() WHERE id = $1', [threadId]);
  // Tell the people taking part (who started it or have written in it)
  const { rows: people } = await pool.query(
    `SELECT created_by::text AS id FROM discussion_threads WHERE id = $1 AND created_by IS NOT NULL
     UNION SELECT DISTINCT created_by::text FROM discussion_posts WHERE thread_id = $1 AND created_by IS NOT NULL AND deleted_at IS NULL`, [threadId]);
  notifyNew({ societyId: a.societyId, kind: 'messages', authorId: a.session!.sub, private: true, to: people.map(r => r.id),
    url: `/society/${a.societyId}/discussions/${threadId}` });
  return NextResponse.json({ id: p.id }, { status: 201 });
}

export const POST = lockSafe(handlePOST);
