import SocietyMeet from '@/components/meet/SocietyMeet';
import { societyIdParam } from '@/lib/societyRef';

export default async function SocietyMeetPage({ params }: { params: Promise<{ id: string }> }) {
  // Access is checked by the Society layout and again by every API call
  return <SocietyMeet societyId={await societyIdParam((await params).id)} />;
}
