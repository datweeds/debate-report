import NewsSettings from '@/components/news/NewsSettings';
import { societyIdParam } from '@/lib/societyRef';

export default async function SocietyNewsSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  // Moderators only; enforced by the settings API
  return <NewsSettings societyId={await societyIdParam((await params).id)} />;
}
