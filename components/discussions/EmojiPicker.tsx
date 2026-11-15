'use client';

import { useEffect, useRef, useState } from 'react';

export const PICKER_EMOJI = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🎉', '🤔', '✅', '😊', '😀', '😉', '😅', '🙂', '👀', '💡', '🔥', '👋', '❌'];

// A small emoji button with a pop-up grid.
export default function EmojiPicker({ onPick, emojis = PICKER_EMOJI, label = 'Add emoji', small }: {
  onPick: (e: string) => void; emojis?: string[]; label?: string; small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-label={label} title={label}
        className={`rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 ${small ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1.5 text-base'}`}>
        {small ? '☺︎+' : '😊'}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 z-30 grid grid-cols-5 gap-1 rounded-xl border border-slate-700 bg-[#0c1322] p-2 shadow-2xl">
          {emojis.map(e => (
            <button key={e} type="button" onClick={() => { onPick(e); setOpen(false); }}
              className="rounded-lg px-1.5 py-1 text-lg hover:bg-slate-700/60">{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}
