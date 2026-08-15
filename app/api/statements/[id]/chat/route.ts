import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { scanContent } from '@/lib/scanner';

type Params = { params: Promise<{ id: string }> };

const ALLOWED_TIERS = new Set(['voter', 'debater', 'moderator', 'sysadmin']);

// GET — all chat messages for a statement, including reaction counts
// ?summary=1 → returns only { count, recentCount } without full messages
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;

  if (new URL(req.url).searchParams.get('summary') === '1') {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)::int                                                           AS total_count,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int  AS recent_count
       FROM comments
       WHERE statement_id = $1 AND comment_status = 'accepted'`,
      [id],
    );
    return NextResponse.json({
      count:       rows[0]?.total_count  ?? 0,
      recentCount: rows[0]?.recent_count ?? 0,
    });
  }

  // Optional auth — needed to show whether current user has reacted
  const session = await getSession().catch(() => null);
  const userId  = session?.sub ?? null;

  const { rows } = await pool.query(
    `SELECT c.id, c.parent_id, c.comment_body, c.is_deleted,
            c.created_at, c.created_by,
            u.user_handle AS author_handle,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'emoji', r.emoji,
                  'count', r.cnt,
                  'userReacted', CASE WHEN $2::uuid IS NOT NULL
                                      THEN COALESCE(r.user_reacted, false)
                                      ELSE false END
                )
                ORDER BY r.emoji
              ) FILTER (WHERE r.emoji IS NOT NULL),
              '[]'::jsonb
            ) AS reactions
     FROM comments c
     LEFT JOIN users u ON u.id = c.created_by
     LEFT JOIN (
       SELECT cr.comment_id, cr.emoji,
              COUNT(*)::int AS cnt,
              BOOL_OR(cr.user_id = $2::uuid) AS user_reacted
       FROM comment_reactions cr
       GROUP BY cr.comment_id, cr.emoji
     ) r ON r.comment_id = c.id
     WHERE c.statement_id = $1
       AND c.comment_status = 'accepted'
     GROUP BY c.id, u.user_handle
     ORDER BY c.created_at ASC`,
    [id, userId],
  );

  const messages = rows.map(r => ({
    id:            r.id,
    parent_id:     r.parent_id,
    body:          r.is_deleted ? '[Deleted message]' : r.comment_body,
    is_deleted:    r.is_deleted,
    created_at:    r.created_at,
    created_by:    r.created_by,
    author_handle: r.is_deleted ? null : r.author_handle,
    reactions:     r.reactions ?? [],
  }));

  return NextResponse.json({ messages });
}

// POST — create a new chat message
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (!ALLOWED_TIERS.has(session.tier)) {
    return NextResponse.json({ error: 'Your account tier cannot post chat messages' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const messageBody: string = (body.body ?? '').toString().trim();
  const parentId: string | null = body.parentId ?? null;

  if (!messageBody) return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
  if (messageBody.length > 2000) return NextResponse.json({ error: 'Message too long (max 2000 chars)' }, { status: 400 });

  const { rows: [stmt] } = await pool.query('SELECT id, resolution_id FROM statements WHERE id = $1', [id]);
  if (!stmt) return NextResponse.json({ error: 'Statement not found' }, { status: 404 });

  if (parentId) {
    const { rows: [parent] } = await pool.query(
      'SELECT id FROM comments WHERE id = $1 AND statement_id = $2',
      [parentId, id],
    );
    if (!parent) return NextResponse.json({ error: 'Parent message not found' }, { status: 404 });
  }

  const { rows: [msg] } = await pool.query(
    `INSERT INTO comments (statement_id, parent_id, comment_body, comment_status, created_by)
     VALUES ($1, $2, $3, 'accepted', $4)
     RETURNING id, parent_id, comment_body AS body, is_deleted, created_at, created_by`,
    [id, parentId, messageBody, session.sub],
  );

  const resolutionId: string = stmt.resolution_id ?? id;
  void scanContent(messageBody, 'comment', msg.id, resolutionId, session.sub);

  return NextResponse.json({
    message: { ...msg, author_handle: session.handle, reactions: [] },
  }, { status: 201 });
}
