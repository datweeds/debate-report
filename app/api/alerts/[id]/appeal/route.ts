import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { isSocietyAdmin } from '@/lib/roles';
import { setText } from '@/lib/scanner';
import { sealText } from '@/lib/societyCrypto';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string }> };

// User submits an appeal for a masked alert
async function handlePOST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id }   = await params;
  const { body } = await req.json() as { body: string };

  if (!body?.trim()) return NextResponse.json({ error: 'Appeal message required' }, { status: 400 });
  if (body.trim().length > 1000) return NextResponse.json({ error: 'Message too long' }, { status: 400 });

  const { rows: [alert] } = await pool.query(
    `SELECT ca.author_id, ca.status, ca.appeal_status, COALESCE(ca.customer_id, r.customer_id) AS customer_id
     FROM content_alerts ca LEFT JOIN statements r ON r.id = ca.resolution_id WHERE ca.id = $1`,
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
    [id, await sealText(alert.customer_id, body.trim())],
  );

  return NextResponse.json({ ok: true });
}

// Society Admin/SysAdmin handles the appeal: outcome = 'unmasked' | 'closed'
async function handlePATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id }      = await params;
  const { outcome } = await req.json() as { outcome: string };

  if (!['unmasked', 'closed'].includes(outcome)) {
    return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [alert] } = await client.query(
      `SELECT ca.content_type, COALESCE(ca.content_key, ca.content_id::text) AS content_key, ca.original_content, ca.appeal_status, COALESCE(ca.customer_id, r.customer_id) AS customer_id
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
    if (alert.customer_id == null ? !session.isSysAdmin : !(await isSocietyAdmin(session, alert.customer_id))) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (alert.appeal_status !== 'sent') {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'No pending appeal' }, { status: 409 });
    }

    if (outcome === 'unmasked' && alert.content_key && alert.original_content) {
      await setText(client, alert.content_type, alert.content_key, alert.original_content);
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

export const POST = lockSafe(handlePOST);
export const PATCH = lockSafe(handlePATCH);
