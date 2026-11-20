'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

// Menu items that gather several dashboard pages (Alerts & Flags, Debates,
// Users) show those pages as tabs, so each keeps its own address.
type Tab = { href: string; label: string; external?: boolean; modOnly?: boolean };
export const DASH_GROUPS: { title: string; tabs: Tab[] }[] = [
  { title: 'Alerts & Flags', tabs: [
    { href: '/dashboard/alerts',  label: 'My alerts & flags' },
    { href: '/dashboard/scanner', label: 'Review queue', modOnly: true },
  ] },
  { title: 'Debates', tabs: [
    { href: '/dashboard/debates',      label: 'Manage' },
    { href: '/dashboard/new-debate',   label: 'New debate' },
    { href: '/dashboard/ai-generator', label: 'AI argument generator' },
    { href: '/dashboard/quality',      label: 'Debate quality' },
    { href: 'https://debate.support',  label: 'Debating guide', external: true },
  ] },
  { title: 'Users', tabs: [
    { href: '/dashboard/join-requests', label: 'Join requests' },
    { href: '/dashboard/invitations',   label: 'Invitations' },
  ] },
];

// Every page address belonging to a group, for the menu's highlight
export const groupPaths = (title: string) =>
  DASH_GROUPS.find(g => g.title === title)?.tabs.filter(t => !t.external).map(t => t.href) ?? [];

export default function GroupTabs() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [moderates, setModerates] = useState(false);
  const group = DASH_GROUPS.find(g => g.tabs.some(t => !t.external && pathname.startsWith(t.href)));

  useEffect(() => {
    if (!user || !group) return;
    if (user.isSysAdmin || user.tier === 'moderator') { setModerates(true); return; }
    fetch('/api/me/roles').then(r => r.ok ? r.json() : null)
      .then(d => setModerates((d?.moderatedSocieties?.length ?? 0) > 0)).catch(() => {});
  }, [user, group]);

  if (!group) return null;
  const tabs = group.tabs.filter(t => !t.modOnly || moderates);
  if (tabs.length < 2) return null;

  return (
    <nav className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-blue-900/20 px-6 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map(t => {
        const active = !t.external && pathname.startsWith(t.href);
        const cls = `whitespace-nowrap rounded-t-lg px-3 py-2 text-sm transition-colors ${
          active ? 'border-b-2 border-blue-400 text-blue-300 font-medium' : 'text-slate-400 hover:bg-blue-500/10 hover:text-blue-300'}`;
        return t.external
          ? <a key={t.href} href={t.href} target="_blank" rel="noopener noreferrer" className={cls}>{t.label} ↗</a>
          : <Link key={t.href} href={t.href} className={cls}>{t.label}</Link>;
      })}
    </nav>
  );
}
