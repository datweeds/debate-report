'use client';
import { useRouter } from 'next/navigation';

export default function TopicDropdown({
  topics,
  selectedId,
  basePath,
}: {
  topics: { id: number; name: string }[];
  selectedId: number | null;
  basePath: string;
}) {
  const router = useRouter();
  return (
    <select
      value={selectedId ?? ''}
      onChange={e => {
        const val = e.target.value;
        router.push(val ? `${basePath}?topic_id=${val}` : basePath);
      }}
      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-slate-500"
    >
      <option value="">All Topics</option>
      {topics.map(t => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  );
}
