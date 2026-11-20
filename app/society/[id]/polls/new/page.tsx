import PollEditor from '@/components/polls/PollEditor';
import { societyIdParam } from '@/lib/societyRef';

export default async function NewPollPage({ params }: { params: Promise<{ id: string }> }) {
  return <PollEditor societyId={await societyIdParam((await params).id)} />;
}
