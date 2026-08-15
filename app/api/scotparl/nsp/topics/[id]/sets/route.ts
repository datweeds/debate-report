import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: topicId } = await params;
  const { description } = await req.json();

  const TENANT_ID = process.env.TENANT_ID ?? '1';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.tenant_id = ${parseInt(TENANT_ID, 10)}`);

    const { rows: [cur] } = await client.query(
      `SELECT id, version FROM nsp_principle_sets
       WHERE topic_id = $1 ORDER BY version DESC LIMIT 1`,
      [topicId]
    );
    const nextVersion = (cur?.version ?? 0) + 1;

    await client.query(
      `UPDATE nsp_principle_sets SET is_current = false WHERE topic_id = $1`,
      [topicId]
    );

    const { rows: [newSet] } = await client.query(
      `INSERT INTO nsp_principle_sets (topic_id, version, description, is_current, created_by)
       VALUES ($1, $2, $3, true, $4) RETURNING id`,
      [topicId, nextVersion, description?.trim() || null, session.sub]
    );

    if (cur?.id) {
      await client.query(
        `INSERT INTO nsp_principles (set_id, sort_order, title, body, grounding)
         SELECT $1, sort_order, title, body, grounding
         FROM nsp_principles WHERE set_id = $2 ORDER BY sort_order, id`,
        [newSet.id, cur.id]
      );
    }

    await client.query('COMMIT');
    return NextResponse.json({ id: newSet.id, version: nextVersion });
  } catch (err) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: String(err) }, { status: 500 });
  } finally {
    client.release();
  }
}
