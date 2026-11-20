'use client';

import { usePathname, useRouter } from 'next/navigation';
import { siteTitle } from '@/lib/sitePages';

// "‹ Back" on main-site pages that have no menu of their own: returns to
// wherever the reader came from on new.vote, or the home page.
export default function SiteBack() {
  const pathname = usePathname();
  const router = useRouter();
  // (Not on a shared document's page: its reader usually arrived from outside)
  if (!siteTitle(pathname) || pathname.startsWith('/s/')) return null;
  function back() {
    let sameSite = false;
    try { sameSite = !!document.referrer && new URL(document.referrer).origin === window.location.origin; } catch { /* no referrer */ }
    if (sameSite && window.history.length > 1) router.back(); else router.push('/');
  }
  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6">
      <button type="button" onClick={back}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 -ml-2 text-sm text-slate-400 transition-colors hover:bg-blue-500/10 hover:text-blue-300">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back
      </button>
    </div>
  );
}
