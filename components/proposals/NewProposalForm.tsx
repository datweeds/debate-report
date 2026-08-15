'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Topic = { id: number; name: string };

export default function NewProposalForm({ topics, basePath = '/scotparl/proposals' }: { topics: Topic[]; basePath?: string }) {
  const router = useRouter();
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [topicId,     setTopicId]     = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, topic_id: topicId ? Number(topicId) : null }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Failed to submit proposal.');
        return;
      }
      const { id } = await res.json();
      router.push(`${basePath}/${id}`);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-400">
          {error}
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Title</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="A concise title for your proposal"
          maxLength={200}
          className="w-full rounded-lg border border-blue-900/30 bg-slate-800/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Topic Area</label>
        <select
          value={topicId}
          onChange={e => setTopicId(e.target.value)}
          className="w-full rounded-lg border border-blue-900/30 bg-slate-800/50 px-3 py-2 text-sm text-slate-100 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
        >
          <option value="">— No specific topic —</option>
          {topics.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
        <p className="mb-2 text-xs text-slate-500">
          Explain what you&apos;re proposing and why. Include context, rationale, and any relevant references.
        </p>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={8}
          placeholder="Describe your proposal in detail…"
          className="w-full rounded-lg border border-blue-900/30 bg-slate-800/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 resize-y"
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? 'Submitting…' : 'Submit Proposal'}
        </button>
        <Link href={basePath} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
          Cancel
        </Link>
      </div>
    </form>
  );
}
