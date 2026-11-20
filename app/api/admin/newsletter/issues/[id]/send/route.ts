import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { loadIssue, renderIssueEmail, renderIssueText, sendMessages, unsubscribeUrlFor } from '@/lib/newsletter';

type Params = { params: Promise<{ id: string }> };

// POST { test: "me@example.org" } — send a test copy to one address (the issue stays a draft)
// POST { confirm: true }         — send to every active subscriber, then archive the issue
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const d = await loadIssue((await params).id);
  if (!d) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
  if (!d.topics.length) return NextResponse.json({ error: 'Add at least one topic first' }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  const subject = d.issue.subject || `new.vote · ${d.issue.title}`;

  if (typeof b.test === 'string') {
    const to = b.test.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return NextResponse.json({ error: 'Enter a valid email address for the test' }, { status: 400 });
    // The test greets you as subscribers will be greeted: by name if you have one on file
    const { rows: [me] } = await pool.query('SELECT user_full_name FROM users WHERE id = $1', [session.sub]);
    const name = me?.user_full_name ?? null;
    const r = await sendMessages([{ To: to, Subject: `[Test] ${subject}`, HtmlBody: renderIssueEmail(d.issue, d.topics, null, name), TextBody: renderIssueText(d.issue, d.topics, null, name), unsubscribeUrl: null }]);
    return r.sent ? NextResponse.json({ ok: true, test: to }) : NextResponse.json({ error: 'The test email could not be sent' }, { status: 502 });
  }

  if (b.confirm !== true) return NextResponse.json({ error: 'Confirm the send' }, { status: 400 });
  // Claim the issue so it can only ever be sent once
  const { rowCount } = await pool.query(`UPDATE newsletter_issues SET status = 'sending', updated_at = now() WHERE id = $1 AND status = 'draft'`, [d.issue.id]);
  if (!rowCount) return NextResponse.json({ error: 'This issue has already been sent' }, { status: 409 });

  const { rows: subs } = await pool.query(`SELECT email, name, unsubscribe_token FROM blog_subscribers WHERE active = true ORDER BY created_at`);
  const r = await sendMessages(subs.map(s => {
    const unsub = unsubscribeUrlFor(s.unsubscribe_token);
    return { To: s.email, Subject: subject, HtmlBody: renderIssueEmail(d.issue, d.topics, unsub, s.name), TextBody: renderIssueText(d.issue, d.topics, unsub, s.name), unsubscribeUrl: unsub };
  }));
  // Archived: the issue and its topics are now a read-only record
  await pool.query(
    `UPDATE newsletter_issues SET status = 'sent', sent_at = now(), sent_count = $2, failed_count = $3, updated_at = now() WHERE id = $1`,
    [d.issue.id, r.sent, r.failed.length]);
  return NextResponse.json({ ok: true, sent: r.sent, failed: r.failed.length, subscribers: subs.length });
}
