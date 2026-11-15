import ProjectList from '@/components/projects/ProjectList';

export default async function SocietyProjectsPage({ params }: { params: Promise<{ id: string }> }) {
  // Access is checked by the Society layout and again by every API call
  return <ProjectList societyId={Number((await params).id)} />;
}
