import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cleanHtml, fmtDate, loadIssue, textOf } from '@/lib/newsletter';
import BlogSubscribeForm from '@/components/BlogSubscribeForm';

type Props = { params: Promise<{ id: string }> };
export const dynamic = 'force-dynamic';

// A sent newsletter issue, on the web ("View this issue in your browser")
async function sentIssue(id: string) {
  const d = await loadIssue(id);
  return d && d.issue.status === 'sent' ? d : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await sentIssue((await params).id);
  if (!d) return { title: 'Newsletter — new.vote' };
  return { title: `${d.issue.title} — new.vote newsletter`, description: textOf(d.topics.map(t => t.title).join(' · ')).slice(0, 160) };
}

export default async function IssuePage({ params }: Props) {
  const d = await sentIssue((await params).id);
  if (!d) notFound();
  const { issue, topics } = d;
  return (
    <div className="min-h-screen bg-dr-base py-16 px-4 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <nav className="flex items-center gap-2 text-xs text-slate-600 mb-10">
          <Link href="/" className="hover:text-slate-400 transition-colors">Home</Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-slate-400 transition-colors">Newsletter</Link>
          <span>/</span>
          <span className="text-slate-400 truncate max-w-48">{issue.title}</span>
        </nav>
        <div className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-3">Newsletter</div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-50 mb-2 leading-tight">{issue.title}</h1>
        {issue.sent_at && <p className="text-sm text-slate-500 mb-10">{fmtDate(issue.sent_at)}</p>}
        {issue.intro_html.trim() && (
          <div className="dr-panel prose-dark rounded-2xl px-6 py-6 sm:px-9 mb-8" dangerouslySetInnerHTML={{ __html: cleanHtml(issue.intro_html) }} />
        )}
        <div className="space-y-8">
          {topics.map(t => (
            <article key={t.id} className="dr-panel rounded-2xl overflow-hidden">
              {t.image_path && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.image_path} alt="" className="w-full max-h-80 object-cover" />
              )}
              <div className="px-6 py-7 sm:px-9">
                <p className="text-xs text-slate-500 mb-1">{fmtDate(t.topic_date)}</p>
                <h2 className="text-2xl font-bold text-slate-100 mb-4 leading-snug">{t.title}</h2>
                <div className="prose-dark" dangerouslySetInnerHTML={{ __html: cleanHtml(t.body_html) }} />
              </div>
            </article>
          ))}
        </div>
        <div className="mt-14"><BlogSubscribeForm /></div>
      </div>
    </div>
  );
}
