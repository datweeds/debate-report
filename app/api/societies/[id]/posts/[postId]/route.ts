import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { discussionAccess, UUID_RE } from '@/lib/discussions';

type Params = { params: Promise<{ id: string; postId: string }> };

async function loadPost(societyId: number, postId: string) {
  if (!UUID_RE.test(postId)) return null;
  const { rows: [p] } = await pool.query(
    `SELECT p.id, p.created_by, p.deleted_at FROM discussion_posts p
     JOIN discussion_threads t ON t.id = p.thread_id
     WHERE p.id = $1 AND t.customer_id = $2 AND t.deleted_at IS NULL`,
    [postId, societyId],
  );
  return p ?? null;
}

// PATCH { body } — the author edits their post.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, postId } = await params;
  const a = await discussionAccess(req, id);
  const post = a ? await loadPost(a.societyId, postId) : null;
  if (!a || !post || post.deleted_at) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (post.created_by !== a.session?.sub) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { body } = await req.json().catch(() => ({}));
  if (typeof body !== 'string' || !body.trim() || body.length > 5000) {
    return NextResponse.json({ error: 'Message must be 1–5,000 characters' }, { status: 400 });
  }
  await pool.query('UPDATE discussion_posts SET body = $1, edited_at = now() WHERE id = $2', [body.trim(), postId]);
  return NextResponse.json({ ok: true });
}

// DELETE — the author, a moderator, or SysAdmin (takedown). Shown as "deleted".
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id, postId } = await params;
  const a = await discussionAccess(req, id);
  const post = a ? await loadPost(a.societyId, postId) : null;
  if (!a || !post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (post.created_by !== a.session?.sub && !a.canTakeDown) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await pool.query('UPDATE discussion_posts SET deleted_at = COALESCE(deleted_at, now()) WHERE id = $1', [postId]);
  return NextResponse.json({ ok: true });
}
