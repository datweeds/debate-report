'use client';

import { useState } from 'react';
import RefPicker, { type Picked } from './RefPicker';

/** Put text into a textarea at its cursor (with spaces round it as needed), keeping React state in step. */
export function insertAtCursor(el: HTMLTextAreaElement | null, value: string, set: (v: string) => void, text: string) {
  const start = el?.selectionStart ?? value.length;
  const end = el?.selectionEnd ?? start;
  const before = value.slice(0, start), after = value.slice(end);
  const t = `${before && !/\s$/.test(before) ? ' ' : ''}${text}${after && !/^\s/.test(after) ? ' ' : after ? '' : ' '}`;
  set(before + t + after);
  requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + t.length, start + t.length); });
}

// A button by a text box that adds a reference to another item of the Society
// (its address: shown to readers as a chip that opens a preview).
export default function RefButton({ society, onPick, className }: {
  society: number; onPick: (p: Picked) => void; className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Reference a note, document, event or discussion" aria-label="Add a reference"
        className={className ?? 'rounded-lg px-2 py-1.5 text-base leading-none text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'}>📎</button>
      {open && <RefPicker society={society} onClose={() => setOpen(false)} onPick={p => { setOpen(false); onPick(p); }} />}
    </>
  );
}
