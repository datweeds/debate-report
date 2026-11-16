'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import SocietyTabs, { SOCIETY_SECTIONS, isSectionActive } from './SocietyTabs';

// The Society's tab bar. Also makes this the visitor's current Society (used
// as the default for things like New Debate) and records which section they
// looked at, so "new since you last looked" counts can be shown.
export default function SocietyFrame({ societyId, manage }: { societyId: number; loggedIn: boolean; manage: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    void fetch('/api/customer/switch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_id: societyId }) });
  }, [societyId]);

  useEffect(() => {
    if (!user) { setCounts({}); return; }
    const section = SOCIETY_SECTIONS.find(s => isSectionActive(pathname, societyId, s.slug));
    const key = section ? (section.slug || 'debates') : null;
    (async () => {
      if (key && key !== 'about' && key !== 'meet') {
        await fetch(`/api/societies/${societyId}/seen`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ section: key }) });
      }
      const r = await fetch(`/api/societies/${societyId}/unread`);
      if (r.ok) setCounts((await r.json()).counts ?? {});
      window.dispatchEvent(new Event('dr:unread-changed'));
    })();
  }, [pathname, societyId, user]);

  return <SocietyTabs societyId={societyId} counts={counts} right={manage} />;
}
