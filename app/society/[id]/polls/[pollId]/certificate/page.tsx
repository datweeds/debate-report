import PollCertificate from '@/components/polls/PollCertificate';
import { societyIdParam } from '@/lib/societyRef';

export default async function PollCertificatePage({ params }: { params: Promise<{ id: string; pollId: string }> }) {
  const { id, pollId } = await params;
  return <PollCertificate societyId={await societyIdParam(id)} pollId={pollId} />;
}
