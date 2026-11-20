'use client';

import { useEffect, useState } from 'react';
import { refPath, REF_ICON, type Ref } from '@/lib/refs';
import { refLabel, resolveRef, type Resolved } from './resolve';
import RefPopup from './RefPopup';

export const CHIP = 'ref-chip';

// A reference shown as a chip with the item's name (as this reader may see
// it). A click opens its preview; Ctrl/middle click opens the item's page.
export default function RefChip({ r }: { r: Ref }) {
  const [v, setV] = useState<Resolved | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let live = true;
    resolveRef(r).then(x => { if (live) setV(x); }).catch(() => { if (live) setV(null); });
    return () => { live = false; };
  }, [r]);
  return (
    <>
      <a href={refPath(r)} className={CHIP} data-gone={v === null ? '' : undefined}
        title={v === null ? 'Deleted, or you don’t have access to it' : 'Preview'}
        onClick={e => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault(); e.stopPropagation(); setOpen(true);
        }}>
        <span aria-hidden>{v?.locked ? '🔐' : REF_ICON[v?.kind ?? r.kind]}</span>{refLabel(v)}
      </a>
      {open && <RefPopup r={r} onClose={() => setOpen(false)} />}
    </>
  );
}
