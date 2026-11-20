import ThreadView from '@/components/discussions/ThreadView';
import { societyIdParam } from '@/lib/societyRef';

export default async function DiscussionThreadPage({ params }: { params: Promise<{ id: string; threadId: string }> }) {
  const { id, threadId } = await params;
  return <ThreadView societyId={await societyIdParam(id)} threadId={threadId} />;
}
