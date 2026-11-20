import SocietyCalendar from '@/components/events/SocietyCalendar';
import { societyIdParam } from '@/lib/societyRef';

export default async function SocietyEventsPage({ params }: { params: Promise<{ id: string }> }) {
  // Access is checked by the Society layout and again by every API call
  return <SocietyCalendar societyId={await societyIdParam((await params).id)} />;
}
