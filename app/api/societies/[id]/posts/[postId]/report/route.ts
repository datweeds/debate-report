import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import pool from '@/lib/db';
import { discussionAccess, UUID_RE } from '@/lib/discussions';
import { openText, sealText } from '@/lib/societyCrypto';
import { PRODUCT_URL, sendContactNotification } from '@/lib/postmark';
import { lockSafe } from '@/lib/lockSafe';

const REPORT_REASONS: Record<string, string> = {
  inappropriate: 'Inappropriate or abusive',
  hate_speech: 'Hate speech',
  personal_data: 'Shares personal data',
  other: 'Something else',
};

// POST { reason, note? } — a member reports a discussion message. It goes to
// the Society's moderators (and Sys Admin) in the alert review queue, and an
// email tells the Society and the site. One report per member per message.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string; postId: string }> }) {
  const { id, postId } = await params;
  const a = await discussionAccess(req, id);
  if (!a?.session || !UUID_RE.test(postId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.isMember && !a.canModerate) return NextResponse.json({ error: 'Only members can report messages' }, { status: 403 });
  const { reason, note, text: shown } = await req.json().catch(() => ({}));
  if (!REPORT_REASONS[reason]) return NextResponse.json({ error: 'Choose a reason' }, { status: 400 });

  const { rows: [p] } = await pool.query(
    `SELECT p.id, p.body, p.created_by, p.thread_id, c.name AS society, c.contact_email
     FROM discussion_posts p JOIN discussion_threads t ON t.id = p.thread_id JOIN customers c ON c.id = t.customer_id
     WHERE p.id = $1 AND t.customer_id = $2 AND p.deleted_at IS NULL AND t.deleted_at IS NULL`, [postId, a.societyId]);
  if (!p) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  if (p.created_by === a.session.sub) return NextResponse.json({ error: 'You can’t report your own message' }, { status: 400 });

  const { rows: [already] } = await pool.query(
    `SELECT 1 FROM content_alerts WHERE content_type = 'discussion_post' AND content_key = $1 AND reported_by = $2`, [postId, a.session.sub]);
  if (already) return NextResponse.json({ error: 'You have already reported this message' }, { status: 409 });

  // A sealed message can't be read here: the reporter's browser sends the text they saw
  const sealedPost = typeof p.body === 'string' && p.body.startsWith('sn1:');
  if (sealedPost && (typeof shown !== 'string' || !shown.trim())) return NextResponse.json({ error: 'Include the message text to report it' }, { status: 400 });
  const text = sealedPost
    ? `[From a sealed discussion: the text as the reporter saw it]\n${(shown as string).trim()}`.slice(0, 2000)
    : (await openText(a.societyId, p.body as string)).slice(0, 2000);
  const cleanNote = typeof note === 'string' ? note.trim().slice(0, 1000) : '';
  await pool.query(
    `INSERT INTO content_alerts (content_type, content_id, content_key, customer_id, content_href, flagged_text, flags, author_id,
                                 status, text_hash, reported_by, report_reason)
     VALUES ('discussion_post', $1::uuid, $10::text, $2, $3, $4, ARRAY['reported', $5::text], $6, 'pending', $7, $8, $9)`,
    [postId, a.societyId, `/society/${a.societyId}/discussions/${p.thread_id}`, await sealText(a.societyId, text, true), reason,
     p.created_by, crypto.createHash('md5').update(`report:${a.session.sub}:${text}`).digest('hex'), a.session.sub,
     cleanNote ? await sealText(a.societyId, cleanNote, true) : null, postId]);

  // Tell the Society and the site. No message text in emails: they leave our servers.
  const msg = `A member reported a discussion message in ${p.society} (${REPORT_REASONS[reason]}).\n\n`
    + `Review it in the alert queue: ${PRODUCT_URL}/dashboard/scanner`;
  const notify = (to?: string) => sendContactNotification({
    name: 'new.vote', email: 'contact@new.vote', subject: `Reported message in ${p.society}`, message: msg,
    context: 'new.vote moderation notices', ...(to ? { to } : {}),
  }).catch(err => console.error('[report] notify', err));
  if (p.contact_email) void notify(p.contact_email);
  void notify();

  return NextResponse.json({ ok: true }, { status: 201 });
}

export const POST = lockSafe(handlePOST);
