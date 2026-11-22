import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { isSocietyAdmin } from '@/lib/roles';
import { currentText, setText, MASK } from '@/lib/scanner';
import { maskItem, unmaskItem } from '@/lib/reports';

type Params = { params: Promise<{ id: string }> };


export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

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
      `SELECT ca.content_type, COALESCE(ca.content_key, ca.content_id::text) AS content_key, ca.original_content, COALESCE(ca.customer_id, r.customer_id) AS customer_id, ca.report_route, ca.item_kind
       FROM content_alerts ca
       LEFT JOIN statements r ON r.id = ca.resolution_id
       WHERE ca.id = $1`,
      [id],
    );
    if (!alert) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    // Profile content belongs to no Society: SysAdmin only
    // Reports for the new.vote team: Sys Admin only
    if (alert.report_route === 'platform' || alert.customer_id == null ? !session.isSysAdmin : !(await isSocietyAdmin(session, alert.customer_id))) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (status === 'masked' && alert.content_key && alert.item_kind) {
      // A reported item: mask all of its text
      const before = await maskItem(client, alert.item_kind, alert.content_key);
      await client.query(`UPDATE content_alerts SET original_content = $1 WHERE id = $2`, [before, id]);
    } else if (status === 'masked' && alert.content_key) {
      // Fetch the current content to save as original before masking
      const currentContent = await currentText(client, alert.content_type, alert.content_key);

      // Save original and apply mask
      await client.query(
        `UPDATE content_alerts SET original_content = $1 WHERE id = $2`,
        [currentContent, id],
      );

      await setText(client, alert.content_type, alert.content_key, MASK);
    }

    if (status === 'unmasked' && alert.content_key && alert.original_content) {
      // Restore original content and close the appeal
      if (alert.item_kind && alert.original_content.startsWith('{"item"')) await unmaskItem(client, alert.original_content, alert.content_key);
      else await setText(client, alert.content_type, alert.content_key, alert.original_content);
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
