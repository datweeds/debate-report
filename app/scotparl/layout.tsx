import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { template: '%s — Scottish Parliament | new.vote', default: 'Scottish Parliament — new.vote' },
};

export default function ScotparlLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-dr-base">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        {children}
      </div>
    </div>
  );
}
