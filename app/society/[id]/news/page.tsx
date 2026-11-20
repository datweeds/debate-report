import SocietyNews from '@/components/news/SocietyNews';
import { societyIdParam } from '@/lib/societyRef';

export default async function SocietyNewsPage({ params }: { params: Promise<{ id: string }> }) {
  // Access is checked by the Society layout and again by every API call
  return <SocietyNews societyId={await societyIdParam((await params).id)} />;
}
