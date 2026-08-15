import { NextRequest, NextResponse } from 'next/server';
import pool, { tq } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { isCustomerAdmin } from '@/lib/roles';

const TENANT_ID = parseInt(process.env.TENANT_ID ?? '1', 10);

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { rows: topics } = await tq(
    `SELECT id, name, description, sort_order FROM nsp_topics ORDER BY sort_order, name`
  );
  return NextResponse.json({ topics });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const canAdmin = session.isSysAdmin || await isCustomerAdmin(session.sub, TENANT_ID);
  if (!canAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, description } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.tenant_id = ${TENANT_ID}`);

    const { rows: [maxOrder] } = await client.query(
      `SELECT COALESCE(MAX(sort_order), -1) AS max FROM nsp_topics`
    );

    const { rows: [topic] } = await client.query(
      `INSERT INTO nsp_topics (name, description, sort_order, created_by)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [name.trim(), description?.trim() || null, maxOrder.max + 1, session.sub]
    );

    await client.query(
      `INSERT INTO nsp_principle_sets (topic_id, version, is_current, created_by)
       VALUES ($1, 1, true, $2)`,
      [topic.id, session.sub]
    );

    await client.query('COMMIT');
    return NextResponse.json({ id: topic.id });
  } catch (err) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: String(err) }, { status: 500 });
  } finally {
    client.release();
  }
}
