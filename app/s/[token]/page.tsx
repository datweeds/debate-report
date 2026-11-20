import type { Metadata } from 'next';
import SharedDocument from '@/components/documents/SharedDocument';

export const metadata: Metadata = { title: 'Shared document', robots: { index: false, follow: false }, referrer: 'no-referrer' };

// A document shared by a Society's moderator (no account needed)
export default async function SharedDocumentPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <div className="min-h-screen bg-dr-base px-4 py-10 sm:px-6">
      <SharedDocument token={(await params).token} />
    </div>
  );
}
