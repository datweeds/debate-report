import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: topicId } = await params;
  const { title, body, grounding } = await req.json();
  if (!title?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'title and body are required' }, { status: 400 });
  }

  const { rows: [cur] } = await pool.query(
    `SELECT id FROM nsp_principle_sets WHERE topic_id = $1 AND is_current = true ORDER BY version DESC LIMIT 1`,
    [topicId]
  );
  if (!cur) return NextResponse.json({ error: 'No current set for this topic' }, { status: 409 });

  const { rows: [maxOrder] } = await pool.query(
    `SELECT COALESCE(MAX(sort_order), -1) AS max FROM nsp_principles WHERE set_id = $1`,
    [cur.id]
  );

  const { rows: [p] } = await pool.query(
    `INSERT INTO nsp_principles (set_id, sort_order, title, body, grounding)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [cur.id, maxOrder.max + 1, title.trim(), body.trim(), grounding?.trim() ?? '']
  );

  return NextResponse.json({ id: p.id });
}
