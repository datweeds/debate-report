'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useEffect, useState } from 'react';

type NavSection = {
  title: string;
  items: NavItemDef[];
};

type NavItemDef = {
  href: string;
  label: string;
  countKey?: 'myPending' | 'scannerPending';
  icon: React.ReactNode;
  modOnly?: boolean;
  allUsers?: boolean;
};

const SECTIONS: NavSection[] = [
  {
    title: 'Content Workflow',
    items: [
      {
        href: '/dashboard/chat-comments',
        label: 'Chat Comments',
        icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
          </svg>
        ),
      },
      {
        href: '/dashboard/your-votes',
        label: 'Your Votes',
        icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z" />
          </svg>
        ),
      },
      {
        href: '/dashboard/alerts',
        label: 'Alerts',
        allUsers: true,
        countKey: 'myPending',
        icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
        ),
      },
      {
        href: '/dashboard/scanner',
        label: 'Scanner',
        modOnly: true,
        countKey: 'scannerPending',
        icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0 1 20.25 6v1.5m0 9V18A2.25 2.25 0 0 1 18 20.25h-1.5m-9 0H6A2.25 2.25 0 0 1 3.75 18v-1.5M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        ),
      },
      {
        href: '/dashboard/invitations',
        label: 'Invitations',
        modOnly: true,
        icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          </svg>
        ),
      },
      {
        href: '/dashboard/join-requests',
        label: 'Join Requests',
        modOnly: true,
        icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Manage Debates',
    items: [
      {
        href: '/dashboard/new-debate',
        label: 'Start a Debate',
        modOnly: true,
        icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        ),
      },
      {
        href: '/dashboard/ai-generator',
        label: 'AI Arg Generator',
        modOnly: true,
        icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
          </svg>
        ),
      },
      {
        href: '/dashboard/debates',
        label: 'Your Debates',
        modOnly: true,
        icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
          </svg>
        ),
      },
      {
        href: '/dashboard/forums',
        label: 'Debate Forums',
        modOnly: true,
        icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
          </svg>
        ),
      },
    ],
  },
];

type Counts = { myPending: number; scannerPending: number };

export default function DashboardNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [counts,      setCounts]      = useState<Counts>({ myPending: 0, scannerPending: 0 });
  const [chamberHref, setChamberHref] = useState('/chamber');

  const isMod = user?.tier === 'moderator' || user?.isSysAdmin;

  useEffect(() => {
    if (!user) return;
    fetch('/api/alerts/counts')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setCounts(d);
        // Use DB value as fallback when localStorage is absent (e.g. different device)
        const dbId: string | null = d.lastResolutionId ?? null;
        try {
          const localId = localStorage.getItem('dr_last_resolution');
          const id = localId ?? dbId;
          if (id) setChamberHref(`/chamber?resolution=${id}`);
        } catch {
          if (dbId) setChamberHref(`/chamber?resolution=${dbId}`);
        }
      })
      .catch(() => {/* silent */});
  }, [user]);

  return (
    <nav className="w-56 flex-shrink-0 border-r border-red-900/40 bg-[#3d0b0b] flex flex-col">
      <div className="px-4 py-4 border-b border-red-900/30">
        <p className="text-xs font-bold text-slate-100 tracking-wide">Dashboard</p>
        {user && (
          <p className="text-[11px] text-slate-400 mt-0.5">@{user.handle}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-3 space-y-5">
        {SECTIONS.map(section => {
          const visibleItems = section.items.filter(item => {
            if (item.modOnly) return isMod;
            if (item.allUsers) return !!user;
            return true;
          });
          if (!visibleItems.length) return null;

          return (
            <div key={section.title}>
              <p className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-widest text-red-400">
                {section.title}
              </p>
              <ul className="space-y-0.5 px-2">
                {visibleItems.map(item => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  const count = item.countKey ? counts[item.countKey] : 0;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                          isActive
                            ? 'bg-amber-500/15 text-amber-200'
                            : 'text-slate-300 hover:bg-red-900/30 hover:text-slate-100'
                        }`}
                      >
                        <span className={isActive ? 'text-amber-400' : 'text-slate-500'}>
                          {item.icon}
                        </span>
                        <span className="flex-1">{item.label}</span>
                        {count > 0 && (
                          <span className="ml-auto rounded-full bg-red-500/25 px-1.5 py-0.5 text-[10px] font-bold text-red-300 leading-none">
                            {count}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="px-3 py-3 border-t border-red-900/30">
        <a
          href={chamberHref}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-200/80 hover:text-white hover:bg-red-900/40 transition-colors"
        >
          <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
          </svg>
          Return to Chamber
        </a>
      </div>
    </nav>
  );
}
