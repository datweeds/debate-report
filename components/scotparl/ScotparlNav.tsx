'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/scotparl',             label: 'Overview',   exact: true },
  { href: '/scotparl/bills',       label: 'Bills',       exact: false },
  { href: '/scotparl/principles',  label: 'Principles',  exact: false },
  { href: '/scotparl/proposals',   label: 'Proposals',      exact: false },
  { href: '/scotparl/debates',     label: 'Debates & Votes', exact: false },
];

export default function ScotparlNav() {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        <span className="mr-3 flex-shrink-0 flex items-center gap-1.5 text-xs font-bold text-slate-400 py-3">
          <svg className="h-3.5 w-3.5 text-blue-400" viewBox="0 0 36 36" fill="currentColor">
            <path d="M18 2C9.163 2 2 9.163 2 18s7.163 16 16 16 16-7.163 16-16S26.837 2 18 2zm0 4c2.09 0 4.08.43 5.876 1.2L8.2 23.876A11.943 11.943 0 0 1 6 18c0-6.627 5.373-12 12-12zm0 24c-2.09 0-4.08-.43-5.876-1.2L27.8 12.124A11.943 11.943 0 0 1 30 18c0 6.627-5.373 12-12 12z"/>
          </svg>
          ScotParl
        </span>
        {NAV.map(n => {
          const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex-shrink-0 px-3 py-3 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? 'text-blue-400 border-blue-500'
                  : 'text-slate-400 border-transparent hover:text-slate-100 hover:border-slate-600'
              }`}
            >
              {n.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
