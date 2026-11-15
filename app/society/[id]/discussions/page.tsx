import ThreadList from '@/components/discussions/ThreadList';

export default async function SocietyDiscussionsPage({ params }: { params: Promise<{ id: string }> }) {
  // Access is checked by the Society layout and again by every API call
  return <ThreadList societyId={Number((await params).id)} />;
}
