'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Switchboard from '@/components/chamber/Switchboard';

// The Debates metric tile on the dashboard — clicking it opens the same
// Switch Debate box used in Chamber, defaulted to this tile's own society
// (or "All Available" for the aggregate tiles), but still letting the
// visitor pick a different one from the dropdown.
export default function DebatesMetricButton({
  value, societyId,
}: {
  value: number;
  societyId: number | 'all';
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl border px-3 py-3 text-center border-blue-800/30 bg-blue-500/5 hover:bg-blue-500/10 transition-colors w-full"
      >
        <p className="font-bold text-xl text-blue-400">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">Debates</p>
      </button>

      {open && (
        <Switchboard
          currentId={null}
          initialSocietyId={societyId}
          onClose={() => setOpen(false)}
          onSelect={id => { setOpen(false); router.push(`/chamber?resolution=${id}`); }}
        />
      )}
    </>
  );
}
