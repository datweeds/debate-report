'use client';

import { useState } from 'react';
import PlaceSearch from './PlaceSearch';
import { setMyArea, useMyArea, LEVEL_LABEL } from './myArea';

// Profile: My area (adults only). Kept only on this device; new.vote never learns it.
export default function MyAreaCard() {
  const mine = useMyArea();
  const [editing, setEditing] = useState(false);
  return (
    <div className="space-y-3" id="my-area">
      <p className="text-xs text-slate-400">
        Optional. Used only to suggest Societies near you. It&apos;s stored <strong className="text-slate-200">only on this device</strong>:
        new.vote never sees it, so you&apos;ll need to set it on each device you use.
      </p>
      {mine && !editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200">{mine.label} <span className="text-xs text-slate-500">({LEVEL_LABEL[mine.level] ?? mine.level})</span></span>
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-blue-400 hover:text-blue-300">Change</button>
          <button type="button" onClick={() => setMyArea(null)} className="text-xs text-slate-500 hover:text-slate-300">Clear</button>
        </div>
      ) : (
        <PlaceSearch precision placeholder="Type your town, city or county…" onPick={a => { setMyArea(a); setEditing(false); }} />
      )}
    </div>
  );
}
