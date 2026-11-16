import NewsSettings from '@/components/news/NewsSettings';

export default async function SocietyNewsSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  // Moderators only; enforced by the settings API
  return <NewsSettings societyId={Number((await params).id)} />;
}
