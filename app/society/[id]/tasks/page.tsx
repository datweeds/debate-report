import { Suspense } from 'react';
import TaskList from '@/components/tasks/TaskList';
import { societyIdParam } from '@/lib/societyRef';

export default async function SocietyTasksPage({ params }: { params: Promise<{ id: string }> }) {
  // Access is checked by the Society layout and again by every API call
  return <Suspense><TaskList societyId={await societyIdParam((await params).id)} /></Suspense>;
}
