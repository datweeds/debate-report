import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import YourContent from '@/components/YourContent';

export const metadata: Metadata = { title: 'My content', robots: { index: false } };

export default async function MyContentPage() {
  if (!(await getSession().catch(() => null))) redirect('/login?next=/my-content');
  return <YourContent />;
}
