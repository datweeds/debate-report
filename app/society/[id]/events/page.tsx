import SocietyCalendar from '@/components/events/SocietyCalendar';

export default async function SocietyEventsPage({ params }: { params: Promise<{ id: string }> }) {
  // Access is checked by the Society layout and again by every API call
  return <SocietyCalendar societyId={Number((await params).id)} />;
}
