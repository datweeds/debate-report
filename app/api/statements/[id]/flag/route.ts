import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { statementAccess } from '@/lib/debateAccess';
import { clientIp } from '@/lib/clientIp';
import { allowReport, submitReport, ANON_PER_DAY } from '@/lib/reports';

type Params = { params: Promise<{ id: string }> };

const VALID_REASONS = new Set(['inappropriate', 'hate_speech', 'personal_data', 'harassment', 'spam', 'illegal']);

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  const userId  = session?.sub ?? null;

  if (!(await statementAccess(session, id))?.viewable) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { rows } = await pool.query(
    `SELECT reason, flagged_by FROM stat_flags WHERE stat_id = $1 AND resolved_at IS NULL`, [id],
  );

  const flagCount   = rows.length;
  const userFlagged = userId ? rows.some(r => r.flagged_by === userId) : false;
  const reasons     = [...new Set(rows.map((r: { reason: string }) => r.reason))];

  return NextResponse.json({ flagCount, userFlagged, reasons });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  const userId  = session?.sub ?? null;

  const body = await req.json().catch(() => ({}));
  const { reason } = body as { reason?: string };

  if (!reason || !VALID_REASONS.has(reason)) {
    return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
  }

  if (!(await statementAccess(session, id))?.viewable) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Prevent logged-in users from flagging the same statement twice
  if (userId) {
    const { rows: [existing] } = await pool.query(
      `SELECT id FROM stat_flags WHERE stat_id = $1 AND flagged_by = $2`, [id, userId],
    );
    if (existing) {
      return NextResponse.json({ error: 'Already flagged', alreadyFlagged: true }, { status: 409 });
    }
  }

  // The same daily limit as other reports (5 a day without an account)
  const ip = clientIp(req.headers);
  if (!(await allowReport(session, ip))) {
    return NextResponse.json({ error: userId
      ? 'You’ve made a lot of reports today. Please try again tomorrow.'
      : `You can make up to ${ANON_PER_DAY} reports a day without an account. Please try again tomorrow, or sign in.` }, { status: 429 });
  }
  // Possibly illegal: the new.vote team reviews it too, urgently
  if (reason === 'illegal') {
    await submitReport({ kind: 'statement', id, reason: 'illegal' }, session, ip, { skipLimit: true })
      .catch(e => { if (!(e instanceof Error) || !('status' in e)) throw e; });
  }

  await pool.query(
    `INSERT INTO stat_flags (stat_id, reason, flagged_by) VALUES ($1, $2, $3)`,
    [id, reason, userId],
  );

  const { rows: [{ count }] } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM stat_flags WHERE stat_id = $1 AND resolved_at IS NULL`, [id],
  );

  return NextResponse.json({ success: true, flagCount: count });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  const userId  = session?.sub ?? null;

  if (!userId) {
    return NextResponse.json({ error: 'Must be logged in to remove a flag' }, { status: 401 });
  }

  await pool.query(
    `DELETE FROM stat_flags WHERE stat_id = $1 AND flagged_by = $2`,
    [id, userId],
  );

  const { rows: [{ count }] } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM stat_flags WHERE stat_id = $1 AND resolved_at IS NULL`, [id],
  );

  return NextResponse.json({ success: true, flagCount: count });
}
