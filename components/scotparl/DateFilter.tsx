'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

const LS_KEY = 'nv_since_date';

export default function DateFilter({
  since,
  pathname,
  isLoggedIn = false,
}: {
  since?: string;
  pathname: string;
  isLoggedIn?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(since ?? '');
  const [showBubble, setShowBubble] = useState(false);

  useEffect(() => {
    if (since) return; // date already in URL — nothing to auto-apply

    const saved = localStorage.getItem(LS_KEY);

    if (isLoggedIn && saved) {
      setValue(saved);
      router.replace(`${pathname}?since=${saved}`);
    } else if (isLoggedIn) {
      setShowBubble(true);
    } else {
      // Pre-fill with 90 days ago for logged-out users
      const d = new Date();
      d.setDate(d.getDate() - 90);
      setValue(d.toISOString().slice(0, 10));
      setShowBubble(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function apply() {
    if (value) localStorage.setItem(LS_KEY, value);
    else localStorage.removeItem(LS_KEY);
    const params = new URLSearchParams();
    if (value) params.set('since', value);
    router.push(value ? `${pathname}?${params}` : pathname);
  }

  function clear() {
    setValue('');
    localStorage.removeItem(LS_KEY);
    router.push(pathname);
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      {showBubble && (
        <p className="rounded-lg border border-blue-700/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-300/80 max-w-xs text-center">
          Enter a date to see activity in the system since that date.
        </p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs text-slate-500 whitespace-nowrap">Changes since:</label>
        <input
          type="date"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && apply()}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500 [color-scheme:dark]"
        />
        <button
          onClick={apply}
          className="rounded px-2.5 py-1 text-xs bg-blue-600 text-white hover:bg-blue-500 transition-colors"
        >
          Apply
        </button>
        {since && (
          <button onClick={clear} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
