import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import MyStuff from '@/components/MyStuff';

export const metadata: Metadata = { title: 'My Stuff', robots: { index: false } };

export default async function MyStuffPage() {
  if (!(await getSession().catch(() => null))) redirect('/login?next=/my-stuff');
  return <MyStuff />;
}
