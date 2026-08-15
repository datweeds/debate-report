import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// User submits an appeal for a masked alert
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id }   = await params;
  const { body } = await req.json() as { body: string };

  if (!body?.trim()) return NextResponse.json({ error: 'Appeal message required' }, { status: 400 });
  if (body.trim().length > 1000) return NextResponse.json({ error: 'Message too long' }, { status: 400 });

  const { rows: [alert] } = await pool.query(
    `SELECT author_id, status, appeal_status FROM content_alerts WHERE id = $1`,
    [id],
  );

  if (!alert) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (alert.author_id !== session.sub) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (alert.status !== 'masked') return NextResponse.json({ error: 'Can only appeal masked content' }, { status: 409 });
  if (alert.appeal_status !== 'none') return NextResponse.json({ error: 'Appeal already submitted' }, { status: 409 });

  await pool.query(
    `UPDATE content_alerts
     SET appeal_body = $2, appeal_at = now(), appeal_status = 'sent'
     WHERE id = $1`,
    [id, body.trim()],
  );

  return NextResponse.json({ ok: true });
}

// Moderator handles the appeal: outcome = 'unmasked' | 'closed'
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (session.tier !== 'moderator' && !session.isSysAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id }      = await params;
  const { outcome } = await req.json() as { outcome: string };

  if (!['unmasked', 'closed'].includes(outcome)) {
    return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [alert] } = await client.query(
      `SELECT content_type, content_id, original_content, appeal_status FROM content_alerts WHERE id = $1`,
      [id],
    );

    if (!alert) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (alert.appeal_status !== 'sent') {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'No pending appeal' }, { status: 409 });
    }

    if (outcome === 'unmasked' && alert.content_id && alert.original_content) {
      switch (alert.content_type) {
        case 'statement_title':
          await client.query(`UPDATE statements SET stat_title = $1 WHERE id = $2`, [alert.original_content, alert.content_id]);
          break;
        case 'statement_description':
          await client.query(`UPDATE statements SET stat_description = $1 WHERE id = $2`, [alert.original_content, alert.content_id]);
          break;
        case 'comment':
          await client.query(`UPDATE comments SET comment_body = $1 WHERE id = $2`, [alert.original_content, alert.content_id]);
          break;
      }
      await client.query(
        `UPDATE content_alerts SET status = 'passed', appeal_status = 'unmasked', reviewed_by = $2, reviewed_at = now() WHERE id = $1`,
        [id, session.sub],
      );
    } else {
      await client.query(
        `UPDATE content_alerts SET appeal_status = 'closed' WHERE id = $1`,
        [id],
      );
    }

    await client.query('COMMIT');
    return NextResponse.json({ ok: true });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[appeal PATCH]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  } finally {
    client.release();
  }
}
