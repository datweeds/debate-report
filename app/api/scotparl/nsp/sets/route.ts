import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { description } = await req.json();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current max version and current set
    const { rows: [cur] } = await client.query(
      `SELECT id, version FROM nsp_principle_sets ORDER BY version DESC LIMIT 1`
    );
    const nextVersion = (cur?.version ?? 0) + 1;

    // Mark all sets as not current
    await client.query(`UPDATE nsp_principle_sets SET is_current = false`);

    // Insert new set
    const { rows: [newSet] } = await client.query(
      `INSERT INTO nsp_principle_sets (version, description, is_current, created_by)
       VALUES ($1, $2, true, $3) RETURNING id`,
      [nextVersion, description?.trim() || null, session.sub]
    );

    // Copy principles from previous set
    if (cur?.id) {
      await client.query(
        `INSERT INTO nsp_principles (set_id, sort_order, title, body, grounding)
         SELECT $1, sort_order, title, body, grounding
         FROM nsp_principles
         WHERE set_id = $2
         ORDER BY sort_order, id`,
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
