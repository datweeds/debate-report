import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllPostSlugs, getPost, formatDate } from '@/lib/blog';
import BlogSubscribeForm from '@/components/BlogSubscribeForm';

interface Props { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return getAllPostSlugs().map(slug => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: 'Post not found' };
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://staging.debate.report';
  return {
    title: `${post.title} — debate.report Blog`,
    description: post.excerpt,
    openGraph: {
      title:         post.title,
      description:   post.excerpt,
      type:          'article',
      url:           `${base}/blog/${slug}`,
      publishedTime: post.date ? new Date(post.date).toISOString() : undefined,
      authors:       post.author ? [post.author] : undefined,
      tags:          post.tags,
      images:        post.image ? [post.image] : [],
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <div className="min-h-screen bg-dr-base py-16 px-4 sm:px-6">
      <div className="mx-auto max-w-2xl">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-slate-600 mb-10">
          <Link href="/" className="hover:text-slate-400 transition-colors">Home</Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-slate-400 transition-colors">Blog</Link>
          <span>/</span>
          <span className="text-slate-400 truncate max-w-48">{post.title}</span>
        </nav>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {post.tags.map(tag => (
              <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-50 mb-4 leading-tight">{post.title}</h1>

        {/* Meta */}
        <div className="flex items-center gap-4 mb-10 pb-6 border-b border-slate-800">
          <span className="text-sm text-slate-400">{post.author}</span>
          <span className="text-slate-700">·</span>
          <span className="text-sm text-slate-500">{formatDate(post.date)}</span>
        </div>

        {/* Hero image */}
        {post.image && (
          <div className="mb-10 rounded-xl overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.image} alt="" className="w-full object-cover max-h-80" />
          </div>
        )}

        {/* Content */}
        <div
          className="prose-dark"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />

        {/* Back */}
        <div className="mt-14 pt-8 border-t border-slate-800">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Blog
          </Link>
        </div>

        {/* Subscribe nudge */}
        <div className="mt-12">
          <BlogSubscribeForm compact />
        </div>

      </div>
    </div>
  );
}
