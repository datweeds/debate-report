// The newsletter: topics written by Sys Admin, gathered into issues, rendered
// to email-safe HTML and sent to blog_subscribers through Postmark's
// broadcast stream. Server-only.

import pool from './db';

const POSTMARK_API = 'https://api.postmarkapp.com';
const TOKEN    = process.env.POSTMARK_SERVER_TOKEN ?? '';
const FROM     = process.env.POSTMARK_FROM_EMAIL ?? 'hello@new.vote';
const STREAM   = process.env.POSTMARK_BROADCAST_STREAM ?? 'broadcast';   // newsletters must not use the transactional stream
export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://new.vote';

export type Topic = { id: string; title: string; image_path: string | null; topic_date: string; body_html: string; issue_id: string | null; position: number };
export type Issue = { id: string; title: string; subject: string | null; intro_html: string; status: 'draft' | 'sending' | 'sent'; sent_at: string | null; sent_count: number; failed_count: number; created_at: string };

export { cleanHtml } from './cleanHtml';
import { cleanHtml } from './cleanHtml';

export const textOf = (html: string) =>
  cleanHtml(html).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h\d|li)>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n').trim();

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const absolute = (p: string | null) => !p ? null : /^https?:\/\//.test(p) ? p : `${BASE_URL}${p.startsWith('/') ? '' : '/'}${p}`;
export const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export const issueUrl = (id: string) => `${BASE_URL}/newsletter/${id}`;

// "Dear David," from a stored name ("David Twaddell"), or "Hello," without one.
// A leading title is kept with the surname: "Dr Jane Smith" → "Dear Dr Smith,".
export function greeting(name: string | null | undefined): string {
  const raw = (name ?? '').replace(/[<>"]/g, '').trim();
  // An all-lower-case name ("jane smith") is capitalised; any other casing is kept as typed
  const parts = (raw === raw.toLowerCase() ? raw.replace(/(^|[\s'-])(\p{L})/gu, (_, p, c) => p + c.toUpperCase()) : raw).split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Hello,';
  if (/^(dr|prof|professor|mr|mrs|ms|miss|mx|sir|dame|rev|cllr)\.?$/i.test(parts[0]) && parts.length > 1) return `Dear ${parts[0]} ${parts[parts.length - 1]},`;
  return `Dear ${parts[0]},`;
}

// An issue as an email: light, table-based and inline-styled so mail clients render it
export function renderIssueEmail(issue: Pick<Issue, 'id' | 'title' | 'intro_html'>, topics: Topic[], unsubscribeUrl: string | null, name?: string | null): string {
  const topicHtml = topics.map(t => {
    const img = absolute(t.image_path);
    return `
      <tr><td style="padding:28px 32px 0 32px;">
        ${img ? `<img src="${esc(img)}" alt="" width="536" style="display:block;width:100%;max-width:536px;height:auto;border-radius:8px;margin:0 0 16px 0;" />` : ''}
        <p style="margin:0 0 4px 0;font-size:12px;color:#64748b;">${esc(fmtDate(t.topic_date))}</p>
        <h2 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;color:#0f172a;">${esc(t.title)}</h2>
        <div style="font-size:15px;line-height:1.65;color:#1e293b;">${cleanHtml(t.body_html)}</div>
      </td></tr>
      <tr><td style="padding:24px 32px 0 32px;"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0;" /></td></tr>`;
  }).join('');
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(issue.title)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;"><tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#0b1220;padding:22px 32px;">
        <a href="${BASE_URL}" style="text-decoration:none;font-size:20px;font-weight:700;color:#f8fafc;">new<span style="color:#60a5fa;">.vote</span></a>
        <p style="margin:6px 0 0 0;font-size:13px;color:#94a3b8;">${esc(issue.title)}</p>
      </td></tr>
      <tr><td style="padding:28px 32px 0 32px;font-size:15px;line-height:1.65;color:#1e293b;">
        <p style="margin:0 0 12px 0;">${esc(greeting(name))}</p>${issue.intro_html.trim() ? cleanHtml(issue.intro_html) : ''}
      </td></tr>
      ${topicHtml}
      <tr><td style="padding:24px 32px 8px 32px;font-size:12px;line-height:1.6;color:#64748b;">
        <a href="${issueUrl(issue.id)}" style="color:#2563eb;">View this issue in your browser</a>
      </td></tr>
      <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px 26px 32px;font-size:12px;line-height:1.7;color:#64748b;">
        <p style="margin:0 0 8px 0;">
          You're receiving this because you subscribed to the new.vote newsletter (formerly the debate.report newsletter).
          ${unsubscribeUrl
            ? `<a href="${esc(unsubscribeUrl)}" style="color:#334155;font-weight:600;">Unsubscribe</a> at any time with one click.`
            : `<span style="color:#94a3b8;">[Test copy: subscribers get a one-click Unsubscribe link here.]</span>`}
        </p>
        <p style="margin:0 0 8px 0;">
          new.vote is made and run by <strong style="color:#334155;">Debate Report Limited</strong>,
          a private limited company registered in Scotland, company number SC858643.
        </p>
        <p style="margin:0;">
          <a href="${BASE_URL}/about" style="color:#64748b;">About us</a> ·
          <a href="${BASE_URL}/privacy" style="color:#64748b;">Privacy policy</a> ·
          <a href="${BASE_URL}/terms" style="color:#64748b;">Terms</a> ·
          <a href="${BASE_URL}/contact" style="color:#64748b;">Contact us</a>
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export function renderIssueText(issue: Pick<Issue, 'id' | 'title' | 'intro_html'>, topics: Topic[], unsubscribeUrl: string | null, name?: string | null): string {
  return [
    `new.vote · ${issue.title}`, '', greeting(name), '',
    issue.intro_html.trim() ? textOf(issue.intro_html) + '\n' : '',
    ...topics.map(t => `${t.title}\n${fmtDate(t.topic_date)}\n\n${textOf(t.body_html)}\n`),
    `View in your browser: ${issueUrl(issue.id)}`, '',
    `You're receiving this because you subscribed to the new.vote newsletter (formerly the debate.report newsletter).`,
    unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : '[Test copy: subscribers get an unsubscribe link here.]', '',
    'new.vote is made and run by Debate Report Limited, a private limited company registered in Scotland, company number SC858643.',
    `About: ${BASE_URL}/about · Privacy: ${BASE_URL}/privacy · Contact: ${BASE_URL}/contact`,
  ].filter(x => x !== '').join('\n');
}

export async function loadIssue(id: string): Promise<{ issue: Issue; topics: Topic[] } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { rows: [issue] } = await pool.query('SELECT * FROM newsletter_issues WHERE id = $1', [id]);
  if (!issue) return null;
  const { rows: topics } = await pool.query(
    `SELECT id, title, image_path, to_char(topic_date, 'YYYY-MM-DD') AS topic_date, body_html, issue_id, position
     FROM newsletter_topics WHERE issue_id = $1 ORDER BY position, topic_date DESC`, [id]);
  return { issue, topics };
}

type Message = { To: string; Subject: string; HtmlBody: string; TextBody: string; unsubscribeUrl: string | null };

// Send in Postmark batches (up to 500 per call). Returns how many were accepted.
export async function sendMessages(messages: Message[]): Promise<{ sent: number; failed: string[] }> {
  if (!TOKEN) return { sent: 0, failed: messages.map(m => m.To) };
  let sent = 0;
  const failed: string[] = [];
  for (let i = 0; i < messages.length; i += 500) {
    const chunk = messages.slice(i, i + 500);
    try {
      const res = await fetch(`${POSTMARK_API}/email/batch`, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Postmark-Server-Token': TOKEN },
        body: JSON.stringify(chunk.map(m => ({
          From: `new.vote <${FROM}>`, To: m.To, Subject: m.Subject, HtmlBody: m.HtmlBody, TextBody: m.TextBody,
          MessageStream: STREAM, TrackOpens: false, TrackLinks: 'None',
          Headers: m.unsubscribeUrl ? [{ Name: 'List-Unsubscribe', Value: `<${m.unsubscribeUrl}>` }] : [],
        }))),
      });
      if (!res.ok) { console.error('[newsletter] batch', res.status, await res.text()); failed.push(...chunk.map(m => m.To)); continue; }
      const results = await res.json() as { ErrorCode: number; To?: string; Message: string }[];
      results.forEach((r, j) => {
        if (r.ErrorCode === 0) sent++;
        else { failed.push(chunk[j].To); console.error('[newsletter]', r.ErrorCode, r.Message); }
      });
    } catch (err) {
      console.error('[newsletter] batch', err);
      failed.push(...chunk.map(m => m.To));
    }
  }
  return { sent, failed };
}

export const unsubscribeUrlFor = (token: string) => `${BASE_URL}/blog/unsubscribe?token=${encodeURIComponent(token)}`;

// Lines like "jane@example.org", "Jane Doe <jane@example.org>", "jane@example.org, Jane Doe"
// or a CSV row with the email in any column.
export function parseSubscribers(text: string): { email: string; name: string | null }[] {
  const out = new Map<string, string | null>();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    if (!m) continue;
    const email = m[0].toLowerCase();
    const rest = line.replace(m[0], '').replace(/[<>"]/g, '').split(/[,;\t]/).map(s => s.trim()).filter(s => s && !/^(true|false|yes|no|\d+)$/i.test(s));
    if (!out.has(email)) out.set(email, rest[0]?.slice(0, 120) || null);
  }
  return [...out].map(([email, name]) => ({ email, name }));
}

export type TopicInput = { title?: unknown; topic_date?: unknown; body_html?: unknown; image_path?: unknown };

// Check a topic's fields; returns an error message or the clean values
export function topicFields(b: TopicInput): string | { title: string; topic_date: string; body_html: string; image_path: string | null } {
  const title = typeof b.title === 'string' ? b.title.trim().slice(0, 200) : '';
  if (!title) return 'A title is required';
  const topic_date = typeof b.topic_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.topic_date) ? b.topic_date : new Date().toISOString().slice(0, 10);
  const body_html = typeof b.body_html === 'string' ? b.body_html.slice(0, 100_000) : '';
  const image_path = typeof b.image_path === 'string' && /^\/uploads\/newsletter\/[\w.-]+$|^https:\/\/\S+$/.test(b.image_path) ? b.image_path : null;
  return { title, topic_date, body_html, image_path };
}

