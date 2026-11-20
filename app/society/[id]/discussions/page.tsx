import ThreadList from '@/components/discussions/ThreadList';
import { societyIdParam } from '@/lib/societyRef';

export default async function SocietyDiscussionsPage({ params }: { params: Promise<{ id: string }> }) {
  // Access is checked by the Society layout and again by every API call
  return <ThreadList societyId={await societyIdParam((await params).id)} />;
}
