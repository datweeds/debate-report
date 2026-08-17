'use client';

import { useState } from 'react';

export default function FavButton({
  endpoint,
  initialValue,
}: {
  endpoint: string;
  initialValue: boolean;
}) {
  const [isFav, setIsFav] = useState(initialValue);
  const [loading, setLoading] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setIsFav(data.isFavourite);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
      className={`flex-shrink-0 rounded-full p-1 transition-colors ${
        isFav
          ? 'text-rose-400 hover:text-rose-300'
          : 'text-slate-600 hover:text-rose-400'
      }`}
    >
      <svg className="h-4 w-4" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
      </svg>
    </button>
  );
}
