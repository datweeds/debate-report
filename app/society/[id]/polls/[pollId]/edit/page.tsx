import PollEditor from '@/components/polls/PollEditor';
import { societyIdParam } from '@/lib/societyRef';

export default async function EditPollPage({ params }: { params: Promise<{ id: string; pollId: string }> }) {
  const { id, pollId } = await params;
  return <PollEditor societyId={await societyIdParam(id)} pollId={pollId} />;
}
