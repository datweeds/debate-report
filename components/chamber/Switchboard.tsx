'use client';

import { useState, useEffect } from 'react';
import { SUBJECT_LABELS, SUBJECT_COLOURS } from './constants';
import type { PublicDebate } from './types';

type Props = {
  currentId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
};

export default function Switchboard({ currentId, onSelect, onClose }: Props) {
  const [debates, setDebates] = useState<PublicDebate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch('/api/debates/public')
      .then(r => r.json())
      .then(setDebates)
      .finally(() => setLoading(false));
  }, []);

  const filtered = debates.filter(d =>
    d.stat_title.toLowerCase().includes(filter.toLowerCase()) ||
    (SUBJECT_LABELS[d.subject_area] ?? d.subject_area).toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0c1322] shadow-2xl flex flex-col max-h-[80vh]">

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-slate-100">Select a Debate</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-800">
          <input
            autoFocus
            type="text"
            placeholder="Filter debates…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-10 text-center text-slate-500 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-sm">No debates found</div>
          ) : (
            filtered.map(d => (
              <button
                key={d.id}
                onClick={() => { onSelect(d.id); onClose(); }}
                className={`w-full text-left px-5 py-4 border-b border-slate-800/60 hover:bg-slate-800/50 transition-colors flex items-start gap-3 ${d.id === currentId ? 'bg-blue-500/8' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-100 font-medium line-clamp-2 leading-snug">{d.stat_title}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold border ${SUBJECT_COLOURS[d.subject_area] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                      {SUBJECT_LABELS[d.subject_area] ?? d.subject_area}
                    </span>
                    {d.child_count > 0 && (
                      <span className="text-xs text-slate-500">{d.child_count} statement{d.child_count !== 1 ? 's' : ''}</span>
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
