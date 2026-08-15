import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllPosts, formatDate } from '@/lib/blog';
import BlogSubscribeForm from '@/components/BlogSubscribeForm';

export const metadata: Metadata = {
  title: 'Blog — debate.report',
  description: 'Thoughts on structured debate, product decisions, and building in public from the debate.report team.',
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="min-h-screen bg-dr-base py-16 px-4 sm:px-6">
      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <div className="mb-12">
          <div className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-3">Blog</div>
          <h1 className="text-4xl font-extrabold text-slate-50 mb-4">Powering local and national debate.</h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xl">
            Thoughts on structured debate, product decisions, and the thinking behind debate.report.
          </p>
        </div>

        {posts.length === 0 ? (
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
