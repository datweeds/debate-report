'use client';

import { useState, useEffect, useRef } from 'react';
import { SUBJECT_LABELS, SUBJECT_COLOURS } from './constants';
import type { PublicDebate } from './types';

type Props = {
  currentId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  initialTopic?: string;
};

export default function Switchboard({ currentId, onSelect, onClose, initialTopic }: Props) {
  const [debates, setDebates] = useState<PublicDebate[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [filter,  setFilter]  = useState('');
  const [topic,   setTopic]   = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch debates once on mount
  useEffect(() => {
    setLoading(true);
    setFetchError('');
    fetch('/api/debates/public')
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: PublicDebate[]) => {
        if (!Array.isArray(data)) throw new Error('Unexpected response');
        setDebates(data);
      })
      .catch(e => setFetchError(e?.message ?? 'Could not load debates'))
      .finally(() => setLoading(false));
  }, []);

  // Apply topic filter once both debates and initialTopic are available
  useEffect(() => {
    if (!initialTopic || debates.length === 0) return;
    if (debates.some(d => d.subject_area === initialTopic)) {
      setTopic(initialTopic);
    }
  }, [initialTopic, debates]);

  // Focus the search input after the modal renders
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const availableTopics = Array.from(
    new Set(debates.map(d => d.subject_area).filter(Boolean))
  ).sort();

  const filtered = debates.filter(d => {
    const matchesTopic = !topic || d.subject_area === topic;
    const q = filter.toLowerCase();
    const matchesText = !q ||
      d.stat_title.toLowerCase().includes(q) ||
      (SUBJECT_LABELS[d.subject_area] ?? d.subject_area).toLowerCase().includes(q);
    return matchesTopic && matchesText;
  });

  function handleClose(e: React.MouseEvent) {
    e.stopPropagation();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="absolute inset-0 bg-slate-950/55" />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0c1322] shadow-2xl flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-slate-100">Select a Debate</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-800 space-y-2">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search debates…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={topic}
            onChange={e => setTopic(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All topics</option>
            {availableTopics.map(t => (
              <option key={t} value={t}>{SUBJECT_LABELS[t] ?? t}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-10 text-center text-slate-500 text-sm">Loading…</div>
          ) : fetchError ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-red-400 text-sm">Could not load debates</p>
              <p className="text-slate-500 text-xs">{fetchError}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-slate-400 text-sm font-medium">
                {topic
                  ? `No debates in "${SUBJECT_LABELS[topic] ?? topic}"`
                  : filter
                    ? `No debates matching "${filter}"`
                    : 'No debates available yet'}
              </p>
              {(topic || filter) && (
                <button
                  type="button"
                  onClick={() => { setTopic(''); setFilter(''); }}
                  className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
                >
                  Show all debates
                </button>
              )}
            </div>
          ) : (
            filtered.map(d => (
              <button
                key={d.id}
                type="button"
                onClick={() => onSelect(d.id)}
                className={`w-full text-left px-5 py-4 border-b border-slate-800/60 hover:bg-slate-800/50 transition-colors flex items-start gap-3 ${d.id === currentId ? 'bg-blue-500/8' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-100 font-medium line-clamp-2 leading-snug mb-1.5">{d.stat_title}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Topic lozenge */}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold border ${SUBJECT_COLOURS[d.subject_area] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                      {SUBJECT_LABELS[d.subject_area] ?? d.subject_area}
                    </span>
                    {d.forum_type === 'private' && d.forum_visibility === 'apply' && (
                      <span className="rounded-full px-2 py-0.5 text-xs font-bold border bg-amber-500/15 text-amber-300 border-amber-500/30">Apply to join</span>
                    )}
                    {d.forum_type === 'private' && d.forum_visibility === 'invite' && (
                      <span className="rounded-full px-2 py-0.5 text-xs font-bold border bg-violet-500/15 text-violet-300 border-violet-500/30">Private</span>
                    )}
                    {/* Stats */}
                    {d.child_count > 0 && (
                      <span className="flex items-center gap-1 text-xs text-slate-500" title="Statements">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                        </svg>
                        {d.child_count}
                      </span>
                    )}
                    {((d.vote_for ?? 0) > 0 || (d.vote_against ?? 0) > 0) && (
                      <span className="flex items-center gap-1 text-xs">
                        <span className="text-emerald-500">{d.vote_for ?? 0}↑</span>
                        <span className="text-rose-500">{d.vote_against ?? 0}↓</span>
                      </span>
                    )}
                    {(d.science_count ?? 0) > 0 && (
                      <span className="flex items-center gap-1 text-xs text-violet-400" title="Science Reports">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                        </svg>
                        {d.science_count}
                      </span>
                    )}
                    {(d.chat_count ?? 0) > 0 && (
                      <span className="flex items-center gap-1 text-xs text-slate-500" title="Chat messages">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                        </svg>
                        {d.chat_count}
                      </span>
                    )}
                  </div>
                </div>
                {d.id === currentId && (
                  <span className="text-xs text-blue-400 font-semibold mt-0.5 flex-shrink-0">Current</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
