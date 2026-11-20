import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import MyData from '@/components/MyData';

export const metadata: Metadata = { title: 'Your data', robots: { index: false } };

export default async function MyDataPage() {
  if (!(await getSession().catch(() => null))) redirect('/login?next=/my-data');
  return <MyData />;
}
