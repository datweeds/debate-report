import { Suspense } from 'react';
import ProjectView from '@/components/projects/ProjectView';

export default async function ProjectPage({ params }: { params: Promise<{ id: string; pid: string }> }) {
  const { id, pid } = await params;
  return <Suspense fallback={null}><ProjectView societyId={Number(id)} projectId={pid} /></Suspense>;
}
