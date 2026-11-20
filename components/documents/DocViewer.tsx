'use client';

import { useEffect } from 'react';

const PREVIEW = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'text/plain']);

// A document opened in a pop-up: images shown whole, PDFs and text in a frame,
// anything else offered as a download. Escape or the backdrop closes it.
export default function DocViewer({ title, fileName, mime, src, onClose, localFile }: {
  title: string; fileName: string | null; mime: string | null; src: string; onClose: () => void;
  localFile?: boolean;   // src is a file opened in this browser (a sealed document): saved under its own name
}) {
  const download = localFile ? { href: src, name: fileName || title } : { href: `${src}?download=1`, name: undefined };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  const canPreview = !!mime && PREVIEW.has(mime);
  const isImage = canPreview && mime!.startsWith('image/');
  // Sized to what it shows: a small box to download, a snug frame round an
  // image, a reading-width pane for text, and nearly the whole screen for a PDF
  const size = !canPreview ? 'max-w-md'
    : isImage ? 'w-auto max-w-[min(64rem,96vw)]'
    : mime === 'text/plain' ? 'h-full max-h-[85vh] w-full max-w-3xl'
    : 'h-full max-h-[92vh] w-full max-w-5xl';
  const btn = 'rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-blue-500/60 hover:bg-blue-500/10';
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className={`dr-panel flex flex-col overflow-hidden rounded-2xl shadow-2xl ${size}`} onClick={e => e.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-700/60 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-100">{title}</p>
            {fileName && fileName !== title && <p className="truncate text-[11px] text-slate-500">{fileName}</p>}
          </div>
          <a href={src} target="_blank" rel="noopener noreferrer" className={btn}>Open in new tab ↗</a>
          <a href={download.href} download={download.name} className={btn}>Download</a>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-700/50 hover:text-white">×</button>
        </div>
        <div className="min-h-0 flex-1 bg-slate-950/60">
          {!canPreview ? (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-sm text-slate-300">This kind of file can’t be shown in the browser.</p>
              <a href={download.href} download={download.name} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">Download it</a>
            </div>
          ) : mime!.startsWith('image/') ? (
            <div className="flex items-center justify-center overflow-auto p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={title} className="max-h-[calc(92vh-5rem)] max-w-full object-contain" />
            </div>
          ) : (
            <iframe src={src} title={title} className="h-full w-full border-0 bg-white" />
          )}
        </div>
      </div>
    </div>
  );
}
