'use client';

import { useEffect } from 'react';
import RefHtml from '@/components/refs/RefHtml';

// A note opened to read. Escape or a click outside closes it.
export default function NoteViewer({ title, html, byline, sealed, onClose, onEdit }: {
  title: string; html: string; byline?: string; sealed?: boolean; onClose: () => void; onEdit?: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="dr-panel flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-2 border-b border-slate-700/60 px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-slate-100">{sealed && <span className="mr-1" title="Sealed: end-to-end encrypted">🔐</span>}{title}</p>
            {byline && <p className="text-[11px] text-slate-500">{byline}</p>}
          </div>
          {onEdit && <button onClick={onEdit} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-blue-500/60 hover:bg-blue-500/10">Edit</button>}
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-700/50 hover:text-white">×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <RefHtml html={html} empty="This note is empty." />
        </div>
      </div>
    </div>
  );
}
