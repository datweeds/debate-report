import FeatureGate from '@/components/societies/FeatureGate';

export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  return <FeatureGate id={(await params).id} feature="events">{children}</FeatureGate>;
}
