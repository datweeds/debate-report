import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support & Investors — new.vote',
  description: 'new.vote is currently being developed. We are looking for investors and local supporters to help us launch.',
};

export default function SupportPage() {
  return (
    <div className="bg-dr-base min-h-screen">

      {/* Hero */}
      <section className="relative overflow-hidden pb-16 pt-16 sm:pt-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[300px] w-[700px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(ellipse, #3b82f6 0%, transparent 70%)' }}
        />
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-blue-400">
            Support &amp; Investors
          </p>
          <h1 className="mb-6 text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight text-slate-100">
            Help us reset the political culture of our nation
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-400 leading-relaxed">
            new.vote is currently being developed, due to launch at the end of 2026. We are looking for investors and passionate local supporters to make it happen.
          </p>
        </div>
      </section>

      {/* Cards */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6 pb-24 space-y-6">

        {/* What we're building */}
        <div className="card-dr px-6 py-7">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
              <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100 mb-2">What we are building</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                new.vote is an online platform for structured, evidence-led public debate and democratic participation. We are developing tools for debating the issues that matter — from local planning decisions to national legislation — with the rigour and courtesy that good democracy demands.
              </p>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                Our platform is due to launch at the end of 2026. The foundations are already in place: the Debate Chamber, Law Monitor, and Society tools you can see here on debate.report are early expressions of what new.vote will become.
              </p>
            </div>
          </div>
        </div>

        {/* Investors */}
        <div className="card-dr px-6 py-7">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <svg className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100 mb-2">Investors</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                We are looking for investors to help fund the infrastructure and to develop our online platform. Building a reliable, secure, and scalable democratic tool takes significant technical investment — in hosting, security, development, and the ongoing work of keeping the platform available to everyone.
              </p>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                If you believe that better public debate leads to better governance, and you are interested in supporting a platform that is built for citizens rather than advertisers, we would love to hear from you.
              </p>
              <div className="mt-4">
                <a
                  href="mailto:invest@new.vote"
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
                >
                  Get in touch
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Local Supporters */}
        <div className="card-dr px-6 py-7">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20">
              <svg className="h-5 w-5 text-violet-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100 mb-2">Local Supporters</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                We are looking for passionate local supporters to help us arrange live debates in the cities and towns across the UK on the topics that matter to our people. The best democratic conversations do not only happen online — they happen in community halls, libraries, and public spaces where people can look each other in the eye.
              </p>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                If you care about your community and want to bring structured, respectful debate to your town or city, we want to hear from you. You do not need a political background — just a belief that people deserve better than the shouting match politics has become.
              </p>
              <div className="mt-4">
                <a
                  href="mailto:support@new.vote"
                  className="inline-flex items-center gap-2 rounded-lg border border-violet-700/40 px-4 py-2 text-sm font-medium text-violet-400 hover:bg-violet-500/10 transition-colors"
                >
                  Become a local supporter
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Mission statement */}
        <div className="rounded-xl border border-blue-900/20 bg-blue-500/5 px-6 py-6">
          <p className="text-center text-sm text-slate-400 leading-relaxed italic max-w-2xl mx-auto">
            &ldquo;This is how we will help to reset the political, legal and governance culture of our nation — by giving every citizen the tools to debate with rigour, listen with openness, and decide with confidence.&rdquo;
          </p>
          <p className="text-center text-xs text-slate-600 mt-3">The new.vote team</p>
        </div>

        {/* Back link */}
        <div className="text-center pt-2">
          <Link href="/" className="text-sm text-blue-500 hover:text-blue-400 underline underline-offset-2 transition-colors">
            ← Back to debate.report
          </Link>
        </div>

      </div>
    </div>
  );
}
