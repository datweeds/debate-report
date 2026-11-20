import PollList from '@/components/polls/PollList';
import { societyIdParam } from '@/lib/societyRef';

export default async function SocietyPollsPage({ params }: { params: Promise<{ id: string }> }) {
  // Access is checked by the Society layout and again by every API call
  return <PollList societyId={await societyIdParam((await params).id)} />;
}
