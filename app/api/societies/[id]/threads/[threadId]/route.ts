import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { openRows, openText, sealText } from '@/lib/societyCrypto';
import { discussionAccess, membersOnly, UUID_RE } from '@/lib/discussions';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string; threadId: string }> };

async function loadThread(societyId: number, threadId: string) {
  if (!UUID_RE.test(threadId)) return null;
  const { rows: [t] } = await pool.query(
    `SELECT t.id, t.title, t.created_at, t.pinned, t.locked, t.created_by, u.user_handle AS author
     FROM discussion_threads t LEFT JOIN users u ON u.id = t.created_by
     WHERE t.id = $1 AND t.customer_id = $2 AND t.deleted_at IS NULL`,
    [threadId, societyId],
  );
  if (t) t.title = await openText(societyId, t.title);
  return t ?? null;
}

// GET — the thread and its posts (oldest first), with reaction counts.
export async function GET(req: NextRequest, { params }: Params) {
  const { id, threadId } = await params;
  const a = await discussionAccess(req, id);
  if (a && !a.isMember && !a.canModerate && !a.breakGlass) return membersOnly(a.societyId, a.session);
  const thread = a ? await loadThread(a.societyId, threadId) : null;
  if (!a || !thread) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const me = a.session?.sub ?? null;
  const { rows: posts } = await pool.query(
    `SELECT p.id, p.reply_to, p.created_at, p.edited_at, p.created_by,
            CASE WHEN p.deleted_at IS NULL THEN p.body END AS body,
            p.deleted_at IS NOT NULL AS deleted,
            u.user_handle AS author, u.user_full_name AS author_name,
            COALESCE((SELECT json_agg(json_build_object('emoji', r.emoji, 'count', r.n, 'mine', r.mine))
                      FROM (SELECT emoji, COUNT(*)::int AS n, bool_or(user_id::text = $2) AS mine
                            FROM discussion_reactions WHERE post_id = p.id GROUP BY emoji) r), '[]') AS reactions
     FROM discussion_posts p LEFT JOIN users u ON u.id = p.created_by
     WHERE p.thread_id = $1
     ORDER BY p.created_at`,
    [threadId, me],
  );
  await openRows(a.societyId, posts, ['body']);
  return NextResponse.json({
    thread, posts, me,
    canPost: a.canPost && !thread.locked, canModerate: a.canModerate, canTakeDown: a.canTakeDown,
  });
}

// PATCH { pinned?, locked?, title? } — moderators.
async function handlePATCH(req: NextRequest, { params }: Params) {
  const { id, threadId } = await params;
  const a = await discussionAccess(req, id);
  const thread = a ? await loadThread(a.societyId, threadId) : null;
  if (!a || !thread) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const isAuthor = a.session?.sub === thread.created_by;
  if (!a.canModerate && !(isAuthor && typeof body.title === 'string' && Object.keys(body).length === 1)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const sets: string[] = []; const vals: unknown[] = [];
  const set = (c: string, v: unknown) => { vals.push(v); sets.push(`${c} = $${vals.length}`); };
  if (typeof body.pinned === 'boolean') set('pinned', body.pinned);
  if (typeof body.locked === 'boolean') set('locked', body.locked);
  if (typeof body.title === 'string' && body.title.trim()) set('title', await sealText(a.societyId, body.title.trim().slice(0, 200)));
  if (sets.length) {
    vals.push(threadId);
    await pool.query(`UPDATE discussion_threads SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
  }
  return NextResponse.json({ ok: true });
}

// DELETE — moderators (or SysAdmin, as takedown) remove the whole thread.
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id, threadId } = await params;
  const a = await discussionAccess(req, id);
  const thread = a ? await loadThread(a.societyId, threadId) : null;
  if (!a || !thread) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canTakeDown) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await pool.query('UPDATE discussion_threads SET deleted_at = now() WHERE id = $1', [threadId]);
  return NextResponse.json({ ok: true });
}

export const PATCH = lockSafe(handlePATCH);
