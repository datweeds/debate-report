'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cleanNoteHtml, noteIsEmpty } from '@/components/documents/noteHtml';
import { parseRef, REF_ICON, type Ref } from '@/lib/refs';
import { refLabel, resolveRef } from './resolve';
import RefPopup from './RefPopup';

// A note's HTML, cleaned, with references to other items shown as chips that
// open a preview. The chips' names are looked up for this reader (the words
// saved in the note are never shown for an item they can't open).
export default function RefHtml({ html, empty }: { html: string; empty?: string }) {
  const clean = useMemo(() => cleanNoteHtml(html), [html]);
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<Ref | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let live = true;
    for (const a of Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
      const r = parseRef(a.getAttribute('href')!);
      if (!r) continue;
      a.className = 'ref-chip';
      a.removeAttribute('target');
      a.title = 'Preview';
      a.dataset.ref = JSON.stringify(r);
      const show = (icon: string, text: string) => {
        const i = document.createElement('span'); i.setAttribute('aria-hidden', 'true'); i.textContent = icon;
        a.replaceChildren(i, document.createTextNode(text));
      };
      show(REF_ICON[r.kind], '…');
      resolveRef(r).then(v => {
        if (!live) return;
        show(v?.locked ? '🔐' : REF_ICON[v?.kind ?? r.kind], refLabel(v));
        if (v === null) { a.dataset.gone = ''; a.title = 'Deleted, or you don’t have access to it'; }
      }).catch(() => { if (live) show(REF_ICON[r.kind], refLabel(null)); });
    }
    return () => { live = false; };
  }, [clean]);

  if (noteIsEmpty(clean)) return <p className="text-sm italic text-slate-500">{empty ?? 'Empty.'}</p>;
  return (
    <>
      <div ref={box} className="note-html text-sm text-slate-200" dangerouslySetInnerHTML={{ __html: clean }}
        onClick={e => {
          const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a.ref-chip');
          if (!a?.dataset.ref || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault(); e.stopPropagation();
          setOpen(JSON.parse(a.dataset.ref));
        }} />
      {open && <RefPopup r={open} onClose={() => setOpen(null)} />}
    </>
  );
}
