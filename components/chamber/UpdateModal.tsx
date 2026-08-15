'use client';

import { useState } from 'react';

type Props = {
  statementId: string;
  initialTitle: string;
  initialDescription: string | null;
  hasChildren: boolean;   // if true, the title is locked (connected responses exist)
  onSave: (id: string, title: string, description: string | null) => void;
  onClose: () => void;
};

export default function UpdateModal({
  statementId, initialTitle, initialDescription, hasChildren, onSave, onClose,
}: Props) {
  const [title,       setTitle]       = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimTitle = hasChildren ? initialTitle : title.trim();
    if (!trimTitle) { setError('Statement title is required.'); return; }
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/statements/${statementId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trimTitle,
          description: description.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Save failed');
        return;
      }
      onSave(statementId, trimTitle, description.trim() || null);
      onClose();
    } catch {
      setError('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#0c1322] shadow-2xl">
        <form onSubmit={handleSubmit}>

          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <h2 className="text-base font-semibold text-slate-100">Update Statement</h2>
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

          <div className="p-5 space-y-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Title field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Statement title
                </label>
                {hasChildren && (
                  <span className="flex items-center gap-1 text-xs text-amber-400/80">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                    Locked — has connected responses
                  </span>
                )}
              </div>
              {hasChildren ? (
                <div className="w-full rounded-lg border border-slate-700/50 bg-slate-800/30 px-3 py-2.5 text-sm text-slate-400 min-h-[4rem] leading-relaxed select-none">
                  {initialTitle}
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    maxLength={510}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-right text-xs text-slate-600">{title.length}/510</p>
                </>
              )}
            </div>

            {/* Description field — always editable */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                Description{' '}
                <span className="text-slate-600 normal-case font-normal">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={7}
                maxLength={2010}
                placeholder="Background context, caveats, sources…"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none placeholder-slate-600"
              />
              <p className="mt-1 text-right text-xs text-slate-600">{description.length}/2010</p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save changes'}
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
