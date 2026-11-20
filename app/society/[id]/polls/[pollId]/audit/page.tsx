import PollAudit from '@/components/polls/PollAudit';
import { societyIdParam } from '@/lib/societyRef';

export default async function PollAuditPage({ params }: { params: Promise<{ id: string; pollId: string }> }) {
  const { id, pollId } = await params;
  return <PollAudit societyId={await societyIdParam(id)} pollId={pollId} />;
}
