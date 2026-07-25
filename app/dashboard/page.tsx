'use client';

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const MODERATOR_TOOLS = [
  {
    href:  '/dashboard/new-debate',
    title: 'Create New Debate',
    desc:  'Write a new resolution and open it to the public forum.',
    icon:  (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
    color: 'text-blue-400 bg-blue-500/10 border-blue-800/30',
    roles: ['moderator', 'sysadmin'],
  },
  {
    href:  '/dashboard/debates',
    title: 'List Debates',
    desc:  'View, edit or delete existing debate resolutions.',
    icon:  (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
      </svg>
    ),
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-800/30',
    roles: ['moderator', 'sysadmin'],
  },
  {
    href:  '/dashboard/alerts',
    title: 'Monitoring Alerts',
    desc:  'Review flagged content and system alerts.',
    icon:  (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
      </svg>
    ),
    color: 'text-amber-400 bg-amber-500/10 border-amber-800/30',
    roles: ['moderator', 'sysadmin'],
    comingSoon: true,
  },
  {
    href:  '/dashboard/moderation',
    title: 'Moderate Content',
    desc:  'Review and approve pending arguments and evidence.',
    icon:  (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-800/30',
    roles: ['moderator', 'sysadmin'],
    comingSoon: true,
  },
  {
    href:  '/dashboard/invitations',
    title: 'Invitations',
    desc:  'Manage access codes and invitations to private forums.',
    icon:  (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
      </svg>
    ),
    color: 'text-violet-400 bg-violet-500/10 border-violet-800/30',
    roles: ['moderator', 'sysadmin'],
    comingSoon: true,
  },
];

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login?next=/dashboard');
  }, [loading, user, router]);

  if (loading || !user) return null;

  const isModerator = user.tier === 'moderator' || user.isSysAdmin;
  const tools = MODERATOR_TOOLS.filter(t => t.roles.includes(user.isSysAdmin ? 'sysadmin' : user.tier));

  return (
    <div className="min-h-screen bg-dr-base px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Welcome back, @{user.handle}</p>
        </div>

        {isModerator ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Moderator tools</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {tools.map(tool => (
                tool.comingSoon ? (
                  <div
                    key={tool.href}
                    className={`card-dr relative flex items-start gap-4 p-5 border opacity-50 cursor-not-allowed ${tool.color}`}
                  >
                    <div className={`rounded-lg p-2 border ${tool.color}`}>{tool.icon}</div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{tool.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{tool.desc}</p>
                    </div>
                    <span className="absolute top-3 right-3 rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-400">
                      Soon
                    </span>
                  </div>
                ) : (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className={`card-dr flex items-start gap-4 p-5 border transition-all hover:scale-[1.01] hover:shadow-lg ${tool.color}`}
                  >
                    <div className={`rounded-lg p-2 border ${tool.color}`}>{tool.icon}</div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{tool.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{tool.desc}</p>
                    </div>
                  </Link>
                )
              ))}
            </div>
          </>
        ) : (
          <div className="card-dr p-6 text-center">
            <p className="text-sm text-slate-400">Moderator tools are available to Moderator tier and above.</p>
          </div>
        )}

      </div>
    </div>
  );
}
