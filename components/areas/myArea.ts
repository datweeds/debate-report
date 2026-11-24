'use client';

import { useEffect, useState } from 'react';

// My area: kept only in this browser, never sent to new.vote. Matching against
// Societies' Areas happens here, using the public list of Societies' Areas.
export type Area = { id: string; label: string; level: string; path: string };
export type AreaFilter = { mode: 'any' } | { mode: 'mine' } | { mode: 'in'; area: Area };
const KEY = 'nv_my_area';
const EVENT = 'nv:my-area';
export const LEVELS = ['town', 'city', 'state_county', 'country'];   // most local first
export const LEVEL_LABEL: Record<string, string> = { town: 'Town', city: 'City', state_county: 'State / county', country: 'Country' };

export function getMyArea(): Area | null {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return v && typeof v.path === 'string' ? v : null; } catch { return null; }
}
export function setMyArea(a: Area | null) {
  try { if (a) localStorage.setItem(KEY, JSON.stringify(a)); else localStorage.removeItem(KEY); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event(EVENT));
}
export function useMyArea(): Area | null {
  const [a, setA] = useState<Area | null>(null);
  useEffect(() => {
    const read = () => setA(getMyArea());
    read();
    window.addEventListener(EVENT, read);
    window.addEventListener('storage', read);
    return () => { window.removeEventListener(EVENT, read); window.removeEventListener('storage', read); };
  }, []);
  return a;
}

type Index = { adult: boolean; societies: { id: number; path: string; level: string }[] };
/** Whether this account may use area features (18+), and the Societies' Areas. Forgets My area if not. */
export function useAreaIndex(key?: unknown): Index | null {
  const [idx, setIdx] = useState<Index | null>(null);
  useEffect(() => {
    let live = true;
    fetch('/api/areas/societies').then(r => r.ok ? r.json() : { adult: false, societies: [] })
      .then((d: Index) => { if (!live) return; if (!d.adult && getMyArea()) setMyArea(null); setIdx(d); })
      .catch(() => { if (live) setIdx({ adult: false, societies: [] }); });
    return () => { live = false; };
  }, [key]);
  return idx;
}

/**
 * The Society ids an area filter allows, most local first.
 *   mine: Societies for my area: my place or anywhere it's inside (Fakenham → Norfolk, England, UK)
 *   in:   Societies in an area: that area or anywhere inside it (Norfolk → every town in Norfolk)
 */
export function matchIds(idx: Index | null, f: AreaFilter, mine: Area | null): number[] | null {
  if (f.mode === 'any' || !idx) return null;
  const at = f.mode === 'mine' ? mine?.path : f.area.path;
  if (!at) return [];
  const hit = idx.societies.filter(s => f.mode === 'mine'
    ? at === s.path || at.startsWith(s.path + '/')
    : s.path === at || s.path.startsWith(at + '/'));
  return hit.sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level)).map(s => s.id);
}
