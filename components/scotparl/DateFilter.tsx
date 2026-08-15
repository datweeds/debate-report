'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function DateFilter({ since, pathname }: { since?: string; pathname: string }) {
  const router = useRouter();
  const [value, setValue] = useState(since ?? '');

  function apply() {
    const params = new URLSearchParams();
    if (value) params.set('since', value);
    router.push(value ? `${pathname}?${params}` : pathname);
  }

  function clear() {
    setValue('');
    router.push(pathname);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="text-xs text-slate-500 whitespace-nowrap">Changes since:</label>
      <input
        type="date"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && apply()}
        className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
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
  );
}
