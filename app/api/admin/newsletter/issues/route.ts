import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { setIssueTopics } from '@/lib/newsletterIssues';

// POST { title, subject?, intro_html?, topicIds[] } — start a draft issue from unused topics
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const title = typeof b.title === 'string' ? b.title.trim().slice(0, 200) : '';
  if (!title) return NextResponse.json({ error: 'Give the issue a title, e.g. "Issue 1 · December 2026"' }, { status: 400 });
  const { rows: [i] } = await pool.query(
    `INSERT INTO newsletter_issues (title, subject, intro_html, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
    [title, typeof b.subject === 'string' && b.subject.trim() ? b.subject.trim().slice(0, 250) : null,
     typeof b.intro_html === 'string' ? b.intro_html.slice(0, 50_000) : '', session.sub]);
  const r = await setIssueTopics(i.id, Array.isArray(b.topicIds) ? b.topicIds : []);
  return NextResponse.json({ id: i.id, ...r }, { status: 201 });
}
