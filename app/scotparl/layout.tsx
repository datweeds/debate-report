import type { Metadata } from 'next';
import ScotparlNav from '@/components/scotparl/ScotparlNav';

export const metadata: Metadata = {
  title: { template: '%s — Scottish Parliament | debate.report', default: 'Scottish Parliament — debate.report' },
};

export default function ScotparlLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-dr-base">
      {/* Sub-navigation */}
      <div className="sticky top-16 z-30 border-b border-slate-800 bg-[#080d1a]/95 backdrop-blur-sm">
        <ScotparlNav />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        {children}
      </div>
    </div>
  );
}
