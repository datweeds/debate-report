import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string; messageId: string }> };

// DELETE — soft-delete a chat message (replaces body with "[Deleted message]")
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id, messageId } = await params;

  const { rows: [msg] } = await pool.query(
    'SELECT id, created_by, is_deleted FROM comments WHERE id = $1 AND statement_id = $2',
    [messageId, id],
  );
  if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  if (msg.is_deleted) return NextResponse.json({ error: 'Already deleted' }, { status: 409 });

  // The Society's moderator, or SysAdmin as the platform takedown backstop
  const { isSocietyModerator, statementSocietyId } = await import('@/lib/roles');
  const { sysAdminMayAct } = await import('@/lib/breakGlass');
  const societyId = await statementSocietyId(id);
  const isMod = await isSocietyModerator(session, societyId) || await sysAdminMayAct(session, societyId);
  if (msg.created_by !== session.sub && !isMod) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await pool.query(
    `UPDATE comments SET is_deleted = TRUE, comment_body = '[Deleted message]' WHERE id = $1`,
    [messageId],
  );

  return NextResponse.json({ ok: true });
}
