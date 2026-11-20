'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import SocietyTabs, { SOCIETY_SECTIONS, isSectionActive, societyRef } from './SocietyTabs';

// The Society's tab bar. Also makes this the visitor's current Society (used
// as the default for things like New Debate) and records which section they
// looked at, so "new since you last looked" counts can be shown.
export default function SocietyFrame({ societyId, slug, manage, disabled }: { societyId: number; slug?: string | null; loggedIn: boolean; manage: React.ReactNode; disabled?: string[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const ref = societyRef(societyId, slug);

  // Reached by its number? Show the Society's name in the address instead
  useEffect(() => {
    const prefix = `/society/${societyId}`;
    if (slug && (pathname === prefix || pathname.startsWith(prefix + '/'))) {
      router.replace(`/society/${slug}${pathname.slice(prefix.length)}${window.location.search}${window.location.hash}`, { scroll: false });
    }
  }, [pathname, societyId, slug, router]);
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    void fetch('/api/customer/switch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_id: societyId }) });
  }, [societyId]);

  useEffect(() => {
    if (!user) { setCounts({}); return; }
    const section = SOCIETY_SECTIONS.find(s => isSectionActive(pathname, ref, s.slug));
    const key = section ? (section.slug || 'debates') : null;
    (async () => {
      // Tasks are personal: no new-item counts
      if (key && key !== 'about' && key !== 'meet' && key !== 'tasks') {
        await fetch(`/api/societies/${societyId}/seen`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ section: key }) });
      }
      const r = await fetch(`/api/societies/${societyId}/unread`);
      if (r.ok) setCounts((await r.json()).counts ?? {});
      window.dispatchEvent(new Event('dr:unread-changed'));
    })();
  }, [pathname, societyId, user]);

  return <SocietyTabs societyId={societyId} slug={slug} counts={counts} right={manage} disabled={disabled} />;
}
