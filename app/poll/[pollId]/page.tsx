import type { Metadata } from 'next';
import CodeVote from '@/components/polls/CodeVote';

export const metadata: Metadata = { title: 'Vote', robots: { index: false } };

// Voting with an access code (no account needed)
export default async function CodePollPage({ params }: { params: Promise<{ pollId: string }> }) {
  return (
    <div className="min-h-screen bg-dr-base px-4 py-10 sm:px-6">
      <CodeVote pollId={(await params).pollId} />
    </div>
  );
}
