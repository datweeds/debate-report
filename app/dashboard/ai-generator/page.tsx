'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AiGeneratorPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login?next=/dashboard/ai-generator');
    if (!loading && user && user.tier !== 'moderator' && !user.isSysAdmin) router.push('/dashboard');
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <div className="px-8 py-10 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">AI Argument Generator</h1>
        <p className="text-sm text-slate-500 mt-1">Automatically generate For / Against arguments for a debate resolution</p>
      </div>

      {/* Placeholder panel */}
      <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-8">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 rounded-xl bg-fuchsia-500/10 border border-fuchsia-800/30 p-3">
            <svg className="h-6 w-6 text-fuchsia-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-200">Coming soon</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-md">
              This tool will let you paste a debate resolution and instantly generate a structured set of
              For and Against arguments using an AI model, which you can then add directly to the chamber.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">AI Provider options</p>
          <div className="space-y-2 text-xs text-slate-500">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-slate-600">▸</span>
              <span><span className="text-slate-300 font-medium">Claude (Anthropic)</span> — Excellent reasoning and nuanced argument generation; strong on academic and policy topics</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-slate-600">▸</span>
              <span><span className="text-slate-300 font-medium">DeepSeek</span> — Cost-effective; strong structured output; good for high-volume generation</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-slate-600">▸</span>
              <span><span className="text-slate-300 font-medium">xAI (current)</span> — Fast; real-time web grounding available</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
