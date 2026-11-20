import ProjectList from '@/components/projects/ProjectList';
import { societyIdParam } from '@/lib/societyRef';

export default async function SocietyProjectsPage({ params }: { params: Promise<{ id: string }> }) {
  // Access is checked by the Society layout and again by every API call
  return <ProjectList societyId={await societyIdParam((await params).id)} />;
}
