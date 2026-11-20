import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { parseSubscribers } from '@/lib/newsletter';

// Newsletter (Admin): topics, issues and subscribers. Sys Admin only.

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const [topics, issues, subs, me] = await Promise.all([
    pool.query(`SELECT t.id, t.title, t.image_path, to_char(t.topic_date, 'YYYY-MM-DD') AS topic_date, t.body_html, t.issue_id, t.position,
                       i.title AS issue_title, i.status AS issue_status
                FROM newsletter_topics t LEFT JOIN newsletter_issues i ON i.id = t.issue_id
                ORDER BY (i.status = 'sent') NULLS FIRST, t.topic_date DESC, t.created_at DESC`),
    pool.query(`SELECT i.*, (SELECT COUNT(*)::int FROM newsletter_topics t WHERE t.issue_id = i.id) AS topic_count
                FROM newsletter_issues i ORDER BY (i.status = 'sent'), COALESCE(i.sent_at, i.created_at) DESC`),
    pool.query(`SELECT COUNT(*) FILTER (WHERE active)::int AS active, COUNT(*)::int AS total FROM blog_subscribers`),
    pool.query(`SELECT email FROM users WHERE id = $1`, [session.sub]),
  ]);
  // Your own address, to fill in "Send a test to me"
  return NextResponse.json({ topics: topics.rows, issues: issues.rows, subscribers: subs.rows[0], myEmail: me.rows[0]?.email ?? null });
}

// POST { subscribers: text } — add subscribers from pasted lines or CSV.
// Existing addresses keep their subscribed/unsubscribed state; a name is only
// filled in where none is on file yet.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { subscribers } = await req.json().catch(() => ({}));
  if (typeof subscribers !== 'string' || !subscribers.trim()) return NextResponse.json({ error: 'Paste some email addresses' }, { status: 400 });
  const list = parseSubscribers(subscribers.slice(0, 2_000_000));
  if (!list.length) return NextResponse.json({ error: 'No email addresses found' }, { status: 400 });
  let added = 0, named = 0;
  for (const s of list) {
    const { rows: [r] } = await pool.query(
      `INSERT INTO blog_subscribers (email, name) VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET name = COALESCE(blog_subscribers.name, EXCLUDED.name)
       RETURNING (xmax = 0) AS inserted, name`, [s.email, s.name]);
    if (r.inserted) added++;
    else if (s.name && r.name === s.name) named++;
  }
  return NextResponse.json({ found: list.length, added, existing: list.length - added, named });
}
