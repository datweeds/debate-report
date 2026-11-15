import ThreadView from '@/components/discussions/ThreadView';

export default async function DiscussionThreadPage({ params }: { params: Promise<{ id: string; threadId: string }> }) {
  const { id, threadId } = await params;
  return <ThreadView societyId={Number(id)} threadId={threadId} />;
}
