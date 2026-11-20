import PollPresent from '@/components/polls/PollPresent';
import { societyIdParam } from '@/lib/societyRef';

export default async function PresentPollPage({ params }: { params: Promise<{ id: string; pollId: string }> }) {
  const { id, pollId } = await params;
  return <PollPresent societyId={await societyIdParam(id)} pollId={pollId} />;
}
