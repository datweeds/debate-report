import SocietyPrinciples from '@/components/principles/SocietyPrinciples';

export default async function SocietyPrinciplesPage({ params }: { params: Promise<{ id: string }> }) {
  // Access is checked by the Society layout and again by every API call
  return <SocietyPrinciples societyId={Number((await params).id)} />;
}
