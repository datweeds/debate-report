import Link from 'next/link';
import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';

export const metadata: Metadata = { title: 'Guides', description: 'Guides to new.vote for guests, members and Society admins.' };

const GUIDES = [
  { href: '/guides/guest', title: 'Guest guide', text: 'What you can see and do without an account, and what opens up when you join or create a Society.', members: false },
  { href: '/guides/member', title: 'Member guide', text: 'Joining a Society, debating, voting in polls, discussions and calls, and working together.', members: true },
  { href: '/guides/admin', title: 'Admin guide', text: 'For Society Admins: what new.vote is for, configuring a Society, its tools, and your responsibilities.', members: true },
];

// Logged-out visitors see only the Guest guide
export default async function GuidesPage() {
  const loggedIn = !!(await getSession().catch(() => null));
  const shown = GUIDES.filter(g => loggedIn || !g.members);
  return (
    <div className="min-h-screen bg-dr-base">
      <section className="mx-auto flex max-w-4xl flex-col gap-4 px-4 pb-6 pt-12 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 sm:text-4xl">Guides</h1>
        <p className="max-w-2xl text-lg leading-relaxed text-slate-400">Everything you need to take part in, or run, a Society on new.vote.</p>
      </section>
      <section className="mx-auto grid max-w-4xl gap-4 px-4 pb-16 sm:grid-cols-3 sm:px-6">
        {shown.map(g => (
          <Link key={g.href} href={g.href} className="dr-panel flex flex-col gap-2 rounded-2xl p-5 transition-colors hover:border-blue-500/60">
            <h2 className="text-lg font-semibold text-slate-100">{g.title}</h2>
            <p className="flex-1 text-sm leading-relaxed text-slate-400">{g.text}</p>
            <span className="text-sm font-semibold text-blue-400">Read →</span>
          </Link>
        ))}
        {!loggedIn && (
          <div className="flex flex-col justify-center gap-2 rounded-2xl border border-dashed border-blue-900/50 p-5 text-sm text-slate-400 sm:col-span-2">
            <p>The Member and Admin guides are for people with an account.</p>
            <p><Link href="/login" className="text-blue-400 hover:text-blue-300">Log in</Link> or <Link href="/pricing" className="text-blue-400 hover:text-blue-300">sign up free</Link> to read them.</p>
          </div>
        )}
      </section>
    </div>
  );
}
