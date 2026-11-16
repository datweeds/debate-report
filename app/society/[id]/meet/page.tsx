import SocietyMeet from '@/components/meet/SocietyMeet';

export default async function SocietyMeetPage({ params }: { params: Promise<{ id: string }> }) {
  // Access is checked by the Society layout and again by every API call
  return <SocietyMeet societyId={Number((await params).id)} />;
}
