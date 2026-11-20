import { Suspense } from 'react';
import DocumentsBrowser from '@/components/documents/DocumentsBrowser';
import { societyIdParam } from '@/lib/societyRef';

export default async function SocietyDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  // Access is checked by the Society layout and again by every API call
  const id = await societyIdParam((await params).id);
  return <Suspense fallback={null}><DocumentsBrowser societyId={id} /></Suspense>;
}
