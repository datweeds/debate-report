'use client';

import { useState } from 'react';
import { PF_ALLOWED_CHILDREN, STAT_LABEL, STAT_BADGE, TYPE_DIRECTION_MODE } from './constants';
import type { ChamberRelationship } from './ChamberGraph';

type Props = {
  parentId: string;
  parentType: string;
  parentTitle: string;
  resolutionId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCreated: (statement: any, relationship: ChamberRelationship) => void;
  onClose: () => void;
};

export default function CreateStatementModal({
  parentId, parentType, parentTitle, resolutionId, onCreated, onClose,
}: Props) {
  const allowedTypes = PF_ALLOWED_CHILDREN[parentType] ?? [];

  const [statType,    setStatType]    = useState(allowedTypes[0] ?? '');
  const [title,       setTitle]       = useState('');
  const [direction,   setDirection]   = useState<'for' | 'against' | ''>('');
  const [description, setDescription] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  const directionMode = TYPE_DIRECTION_MODE[statType] ?? 'user';

  // Determine the effective direction to submit
  const effectiveDirection: 'for' | 'against' | null =
    directionMode === 'neutral'      ? null :
    directionMode === 'auto-against' ? 'against' :
    direction === 'for' || direction === 'against' ? direction : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimTitle = title.trim();
    if (!trimTitle) { setError('Statement text is required.'); return; }
    if (directionMode === 'user' && !direction) { setError('Please select a direction (For or Against).'); return; }
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentId,
          resolutionId,
          statType,
          statTitle: trimTitle,
          statDirection: effectiveDirection,
          statDescription: description.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Could not create statement');
        return;
      }
      const { statement, relationship } = await res.json();
      onCreated(statement, relationship);
      onClose();
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0c1322] shadow-2xl">
        <form onSubmit={handleSubmit}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-100">Add Connected Statement</h2>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">
                Supporting: <span className="text-slate-400">{parentTitle}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-5 space-y-5">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Statement type selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                Statement type
              </label>
              <div className="flex flex-wrap gap-2">
                {allowedTypes.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setStatType(type);
                      setDirection(''); // reset direction when type changes
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold border transition-all ${
                      statType === type
                        ? (STAT_BADGE[type] ?? 'bg-blue-600 text-white border-blue-500') + ' ring-2 ring-white/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {STAT_LABEL[type] ?? type}
                  </button>
                ))}
              </div>
            </div>

            {/* Direction (only for types where user picks) */}
            {directionMode === 'user' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Direction
                </label>
                <div className="flex gap-2">
                  {(['for', 'against'] as const).map(dir => (
                    <button
                      key={dir}
                      type="button"
                      onClick={() => setDirection(dir)}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold border transition-all capitalize ${
                        direction === dir
                          ? dir === 'for'
                            ? 'bg-blue-600/80 text-blue-100 border-blue-500 ring-2 ring-blue-400/30'
                            : 'bg-rose-600/80 text-rose-100 border-rose-500 ring-2 ring-rose-400/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {dir === 'for' ? 'For the resolution' : 'Against the resolution'}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {directionMode === 'auto-against' && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/30 px-3 py-2">
                <svg className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                </svg>
                <span className="text-xs text-slate-500">
                  A {STAT_LABEL[statType]} is always directed <strong className="text-slate-400">against</strong> the statement it challenges.
                </span>
              </div>
            )}

            {/* Statement text */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                Statement text <span className="text-red-400">*</span>
              </label>
              <textarea
                value={title}
                onChange={e => setTitle(e.target.value)}
                rows={3}
                maxLength={510}
                placeholder={`Enter your ${STAT_LABEL[statType]?.toLowerCase() ?? 'statement'} here…`}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none placeholder-slate-600"
              />
              <p className="mt-1 text-right text-xs text-slate-600">{title.length}/510</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                Description / supporting detail{' '}
                <span className="text-slate-600 normal-case font-normal">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                maxLength={2010}
                placeholder="Expand on the statement, add context, cite sources…"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none placeholder-slate-600"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={saving || !statType}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Creating…' : `Add ${STAT_LABEL[statType] ?? 'Statement'}`}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Cancel
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
