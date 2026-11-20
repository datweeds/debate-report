import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { loadIssue, renderIssueEmail } from '@/lib/newsletter';
import { setIssueTopics } from '@/lib/newsletterIssues';

type Params = { params: Promise<{ id: string }> };

// GET — the issue as its email (for the preview)
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const d = await loadIssue((await params).id);
  if (!d) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
  const { rows: [me] } = await pool.query('SELECT user_full_name FROM users WHERE id = $1', [session.sub]);
  return NextResponse.json({ ...d, html: renderIssueEmail(d.issue, d.topics, null, me?.user_full_name ?? null) });
}

// PATCH { title?, subject?, intro_html?, topicIds? } — drafts only
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const d = await loadIssue((await params).id);
  if (!d) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
  if (d.issue.status !== 'draft') return NextResponse.json({ error: 'This issue has been sent, so it is archived' }, { status: 409 });
  const b = await req.json().catch(() => ({}));
  const title = typeof b.title === 'string' && b.title.trim() ? b.title.trim().slice(0, 200) : d.issue.title;
  const subject = typeof b.subject === 'string' ? (b.subject.trim().slice(0, 250) || null) : d.issue.subject;
  const intro = typeof b.intro_html === 'string' ? b.intro_html.slice(0, 50_000) : d.issue.intro_html;
  await pool.query(`UPDATE newsletter_issues SET title = $2, subject = $3, intro_html = $4, updated_at = now() WHERE id = $1`, [d.issue.id, title, subject, intro]);
  const r = Array.isArray(b.topicIds) ? await setIssueTopics(d.issue.id, b.topicIds) : { skipped: 0 };
  return NextResponse.json({ ok: true, ...r });
}

// DELETE — a draft issue; its topics become available again
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const d = await loadIssue((await params).id);
  if (!d) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
  if (d.issue.status !== 'draft') return NextResponse.json({ error: 'A sent issue is kept as a record' }, { status: 409 });
  await pool.query('UPDATE newsletter_topics SET issue_id = NULL, position = 0 WHERE issue_id = $1', [d.issue.id]);
  await pool.query('DELETE FROM newsletter_issues WHERE id = $1', [d.issue.id]);
  return NextResponse.json({ ok: true });
}
