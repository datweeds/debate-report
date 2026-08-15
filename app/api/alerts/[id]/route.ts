import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

const MASK = '*** content masked by scanning protection ***';

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (session.tier !== 'moderator' && !session.isSysAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id }     = await params;
  const { status } = await req.json() as { status: string };

  const validStatuses = ['passed', 'masked', 'unmasked'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [alert] } = await client.query(
      `SELECT content_type, content_id, original_content FROM content_alerts WHERE id = $1`,
      [id],
    );
    if (!alert) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (status === 'masked' && alert.content_id) {
      // Fetch the current content to save as original before masking
      let currentContent: string | null = null;
      switch (alert.content_type) {
        case 'statement_title': {
          const { rows: [row] } = await client.query(
            `SELECT stat_title AS txt FROM statements WHERE id = $1`, [alert.content_id],
          );
          currentContent = row?.txt ?? null;
          break;
        }
        case 'statement_description': {
          const { rows: [row] } = await client.query(
            `SELECT stat_description AS txt FROM statements WHERE id = $1`, [alert.content_id],
          );
          currentContent = row?.txt ?? null;
          break;
        }
        case 'comment': {
          const { rows: [row] } = await client.query(
            `SELECT comment_body AS txt FROM comments WHERE id = $1`, [alert.content_id],
          );
          currentContent = row?.txt ?? null;
          break;
        }
      }

      // Save original and apply mask
      await client.query(
        `UPDATE content_alerts SET original_content = $1 WHERE id = $2`,
        [currentContent, id],
      );

      switch (alert.content_type) {
        case 'statement_title':
          await client.query(`UPDATE statements SET stat_title = $1 WHERE id = $2`, [MASK, alert.content_id]);
          break;
        case 'statement_description':
          await client.query(`UPDATE statements SET stat_description = $1 WHERE id = $2`, [MASK, alert.content_id]);
          break;
        case 'comment':
          await client.query(`UPDATE comments SET comment_body = $1 WHERE id = $2`, [MASK, alert.content_id]);
          break;
      }
    }

    if (status === 'unmasked' && alert.content_id && alert.original_content) {
      // Restore original content and close the appeal
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
        `UPDATE content_alerts SET status = $2, reviewed_by = $3, reviewed_at = now() WHERE id = $1`,
        [id, status, session.sub],
      );
    }

    await client.query('COMMIT');
    return NextResponse.json({ ok: true });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[alerts PATCH]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  } finally {
    client.release();
  }
}
