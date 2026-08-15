import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAllPosts } from '@/lib/blog';
import { sendBlogNewsletter } from '@/lib/postmark';
import { getSession } from '@/lib/auth';

// GET — subscriber count + posts + send history
export async function GET() {
  const [subsRow, sendsRow] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS n FROM blog_subscribers WHERE active = true'),
    pool.query('SELECT post_slug, sent_count, created_at FROM blog_sends ORDER BY created_at DESC'),
  ]);

  const posts = getAllPosts();
  const sentSlugs = new Set(sendsRow.rows.map((r: { post_slug: string }) => r.post_slug));

  return NextResponse.json({
    subscriberCount: subsRow.rows[0].n,
    posts:           posts.map(p => ({ ...p, sent: sentSlugs.has(p.slug) })),
    sends:           sendsRow.rows,
  });
}

// POST — send a newsletter for a given post slug
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.isSysAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { slug } = await req.json();
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });

  // Get post metadata
  const posts = getAllPosts();
  const post  = posts.find(p => p.slug === slug);
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  // Fetch active subscribers
  const { rows: subscribers } = await pool.query(
    'SELECT email, name, unsubscribe_token FROM blog_subscribers WHERE active = true',
  );

  if (subscribers.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0 });
  }

  let sent = 0;
  const errors: string[] = [];

  for (const sub of subscribers) {
    try {
      await sendBlogNewsletter({
        to:               sub.email,
        subscriberName:   sub.name || '',
        postTitle:        post.title,
        postExcerpt:      post.excerpt,
        postImageUrl:     post.image || '',
        postSlug:         post.slug,
        unsubscribeToken: sub.unsubscribe_token,
      });
      sent++;
    } catch (err) {
      errors.push(sub.email);
      console.error(`[blog/send] Failed for ${sub.email}:`, err);
    }
  }

  // Record the send
  await pool.query(
    `INSERT INTO blog_sends (post_slug, sent_count, sent_by)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [slug, sent, session.sub],
  );

  return NextResponse.json({
    ok:      true,
    sent,
    failed:  errors.length,
    total:   subscribers.length,
  });
}
