import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string; messageId: string }> };

const ALLOWED_TIERS = new Set(['voter', 'debater', 'moderator', 'sysadmin']);

const ALLOWED_EMOJI = new Set(['👍','👎','❤️','😂','😮','🔥','🤔','👏']);

// POST — toggle an emoji reaction on a message
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (!ALLOWED_TIERS.has(session.tier)) {
    return NextResponse.json({ error: 'Your account tier cannot react to messages' }, { status: 403 });
  }

  const { messageId } = await params;
  const body = await req.json();
  const emoji: string = (body.emoji ?? '').toString().trim();

  if (!ALLOWED_EMOJI.has(emoji)) {
    return NextResponse.json({ error: 'Emoji not allowed' }, { status: 400 });
  }

  // Check message exists and is not deleted
  const { rows: [msg] } = await pool.query(
    'SELECT id, is_deleted FROM comments WHERE id = $1',
    [messageId],
  );
  if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  if (msg.is_deleted) return NextResponse.json({ error: 'Cannot react to deleted message' }, { status: 409 });

  // Toggle: delete if exists, insert if not
  const { rows: [existing] } = await pool.query(
    'SELECT id FROM comment_reactions WHERE comment_id = $1 AND user_id = $2 AND emoji = $3',
    [messageId, session.sub, emoji],
  );

  if (existing) {
    await pool.query('DELETE FROM comment_reactions WHERE id = $1', [existing.id]);
  } else {
    await pool.query(
      'INSERT INTO comment_reactions (comment_id, user_id, emoji) VALUES ($1, $2, $3)',
      [messageId, session.sub, emoji],
    );
  }

  // Return updated count for this emoji
  const { rows: [{ cnt }] } = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM comment_reactions WHERE comment_id = $1 AND emoji = $2',
    [messageId, emoji],
  );

  return NextResponse.json({ reacted: !existing, count: cnt });
}
