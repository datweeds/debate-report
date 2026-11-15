import { Suspense } from 'react';
import DocumentsBrowser from '@/components/documents/DocumentsBrowser';

export default async function SocietyDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  // Access is checked by the Society layout and again by every API call
  const id = Number((await params).id);
  return <Suspense fallback={null}><DocumentsBrowser societyId={id} /></Suspense>;
}
