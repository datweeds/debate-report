import PollView from '@/components/polls/PollView';
import { getSession } from '@/lib/auth';
import { societyIdParam } from '@/lib/societyRef';

export default async function PollPage({ params }: { params: Promise<{ id: string; pollId: string }> }) {
  const { id, pollId } = await params;
  const session = await getSession();
  return <PollView societyId={await societyIdParam(id)} pollId={pollId} me={session?.sub ?? null} />;
}
