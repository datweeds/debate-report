'use client';

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const QUICK_LINKS = [
  { href: '/dashboard/chat-comments', label: 'Chat Comments',    color: 'text-sky-400',    bg: 'bg-sky-500/8 border-sky-800/30',    modOnly: false },
  { href: '/dashboard/your-votes',    label: 'Your Votes',       color: 'text-emerald-400', bg: 'bg-emerald-500/8 border-emerald-800/30', modOnly: false },
  { href: '/dashboard/alerts',        label: 'Alerts & Flags',   color: 'text-amber-400',  bg: 'bg-amber-500/8 border-amber-800/30',  modOnly: true  },
  { href: '/dashboard/invitations',   label: 'Invitations',      color: 'text-violet-400', bg: 'bg-violet-500/8 border-violet-800/30', modOnly: true  },
  { href: '/dashboard/join-requests', label: 'Join Requests',    color: 'text-rose-400',   bg: 'bg-rose-500/8 border-rose-800/30',    modOnly: true  },
  { href: '/dashboard/new-debate',    label: 'Start a Debate',   color: 'text-blue-400',   bg: 'bg-blue-500/8 border-blue-800/30',    modOnly: true  },
  { href: '/dashboard/ai-generator',  label: 'AI Arg Generator', color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/8 border-fuchsia-800/30', modOnly: true },
  { href: '/dashboard/debates',       label: 'Your Debates',     color: 'text-cyan-400',   bg: 'bg-cyan-500/8 border-cyan-800/30',    modOnly: true  },
  { href: '/dashboard/forums',        label: 'Debate Forums',    color: 'text-indigo-400', bg: 'bg-indigo-500/8 border-indigo-800/30', modOnly: true  },
];

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login?next=/dashboard');
  }, [loading, user, router]);

  if (loading || !user) return null;

  const isMod = user.tier === 'moderator' || user.isSysAdmin;
  const links = QUICK_LINKS.filter(l => !l.modOnly || isMod);

  return (
    <div className="px-8 py-10 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Overview</h1>
        <p className="text-sm text-slate-500 mt-1">Welcome back, @{user.handle}</p>
      </div>

      <p className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-3">Quick access</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {links.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium transition-all hover:scale-[1.02] hover:shadow-md ${link.color} ${link.bg}`}
          >
            <span className="text-[15px]">→</span>
            {link.label}
          </Link>
        ))}
      </div>

      {!isMod && (
        <p className="mt-8 text-xs text-slate-600 italic">
          Debate management tools are available to Moderator tier and above.
        </p>
      )}
    </div>
  );
}
