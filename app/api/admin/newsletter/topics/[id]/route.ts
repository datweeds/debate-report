import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { topicFields } from '@/lib/newsletter';

type Params = { params: Promise<{ id: string }> };

// A topic in a sent issue is archived: it can't be changed or removed
async function editable(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { rows: [t] } = await pool.query(
    `SELECT t.id, i.status FROM newsletter_topics t LEFT JOIN newsletter_issues i ON i.id = t.issue_id WHERE t.id = $1`, [id]);
  return t ?? null;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const t = await editable((await params).id);
  if (!t) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
  if (t.status && t.status !== 'draft') return NextResponse.json({ error: 'This topic has been sent, so it is archived' }, { status: 409 });
  const f = topicFields(await req.json().catch(() => ({})));
  if (typeof f === 'string') return NextResponse.json({ error: f }, { status: 400 });
  await pool.query(
    `UPDATE newsletter_topics SET title = $2, topic_date = $3, body_html = $4, image_path = $5, updated_at = now() WHERE id = $1`,
    [t.id, f.title, f.topic_date, f.body_html, f.image_path]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const t = await editable((await params).id);
  if (!t) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
  if (t.status && t.status !== 'draft') return NextResponse.json({ error: 'This topic has been sent, so it is archived' }, { status: 409 });
  await pool.query('DELETE FROM newsletter_topics WHERE id = $1', [t.id]);
  return NextResponse.json({ ok: true });
}
