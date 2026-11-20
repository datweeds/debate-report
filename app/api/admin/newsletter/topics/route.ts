import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { topicFields } from '@/lib/newsletter';

// POST — write a topic
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const f = topicFields(await req.json().catch(() => ({})));
  if (typeof f === 'string') return NextResponse.json({ error: f }, { status: 400 });
  const { rows: [t] } = await pool.query(
    `INSERT INTO newsletter_topics (title, topic_date, body_html, image_path, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [f.title, f.topic_date, f.body_html, f.image_path, session.sub]);
  return NextResponse.json({ id: t.id }, { status: 201 });
}
