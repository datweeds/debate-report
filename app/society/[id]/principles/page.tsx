import SocietyPrinciples from '@/components/principles/SocietyPrinciples';
import { societyIdParam } from '@/lib/societyRef';

export default async function SocietyPrinciplesPage({ params }: { params: Promise<{ id: string }> }) {
  // Access is checked by the Society layout and again by every API call
  return <SocietyPrinciples societyId={await societyIdParam((await params).id)} />;
}
