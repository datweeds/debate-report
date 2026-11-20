import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllPosts, formatDate } from '@/lib/blog';
import BlogSubscribeForm from '@/components/BlogSubscribeForm';
import pool from '@/lib/db';
import { fmtDate } from '@/lib/newsletter';

export const dynamic = 'force-dynamic';

// Sent newsletter issues, newest first, with their topic titles
async function sentIssues(): Promise<{ id: string; title: string; sent_at: string; topics: string[] }[]> {
  try {
    const { rows } = await pool.query(
      `SELECT i.id, i.title, i.sent_at, COALESCE(array_agg(t.title ORDER BY t.position) FILTER (WHERE t.id IS NOT NULL), '{}') AS topics
       FROM newsletter_issues i LEFT JOIN newsletter_topics t ON t.issue_id = i.id
       WHERE i.status = 'sent' GROUP BY i.id ORDER BY i.sent_at DESC LIMIT 50`);
    return rows;
  } catch { return []; }
}

export const metadata: Metadata = {
  title: 'Newsletter — new.vote',
  description: 'Thoughts on structured debate, product decisions, and building in public from the new.vote team.',
};

export default async function BlogPage() {
  const posts = getAllPosts();
  const issues = await sentIssues();

  return (
    <div className="min-h-screen bg-dr-base py-16 px-4 sm:px-6">
      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <div className="mb-12">
          <div className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-3">Newsletter</div>
          <h1 className="text-4xl font-extrabold text-slate-50 mb-4">Powering local and national debate.</h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xl">
            Thoughts on structured debate, product decisions, and the thinking behind new.vote.
          </p>
        </div>

        {issues.length > 0 && (
          <div className="mb-12 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Issues</h2>
            {issues.map(i => (
              <Link key={i.id} href={`/newsletter/${i.id}`} className="group block card-dr p-5 transition-all hover:border-blue-500/40">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-lg font-bold text-slate-100 group-hover:text-blue-300 transition-colors">{i.title}</h3>
                  <span className="text-xs text-slate-500">{fmtDate(i.sent_at)}</span>
                </div>
                {i.topics.length > 0 && <p className="mt-1 text-sm text-slate-400">{i.topics.join(' · ')}</p>}
              </Link>
            ))}
          </div>
        )}

        {posts.length === 0 && issues.length > 0 ? null : posts.length === 0 ? (
          <div className="card-dr p-12 text-center mb-12">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-100 mb-2">First post coming soon</h2>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Subscribe below to be notified when we publish.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 mb-12">
            {posts.map((post, i) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className={`group card-dr p-6 transition-all ${i === 0 ? 'sm:col-span-2' : ''}`}
                style={{ backgroundColor: '#1a2438', borderColor: 'rgba(59,130,246,0.28)' }}
              >
                {post.image && i === 0 && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.image} alt="" className="w-full h-48 object-cover rounded-xl mb-5" />
                )}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {post.tags?.map(tag => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
                      {tag}
                    </span>
                  ))}
                </div>
                <h2 className={`font-bold text-slate-100 mb-2 group-hover:text-blue-300 transition-colors leading-snug ${i === 0 ? 'text-2xl' : 'text-lg'}`}>
                  {post.title}
                </h2>
                <p className="text-slate-500 text-sm leading-relaxed mb-4">{post.excerpt}</p>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>{post.author}</span>
                  <span>{formatDate(post.date)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Subscribe */}
        <BlogSubscribeForm />
      </div>
    </div>
  );
}
