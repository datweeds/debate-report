'use client';

// Looking up referenced items for this reader: asked for in batches, kept for a
// minute, and sealed items' text opened with the reader's own keys (when their
// secure access is unlocked on this device).

import { keysFor, openItemText, type ItemKeys } from '@/components/sealed/items';
import { secureAccessNow } from '@/components/sealed/useSecureAccess';
import { refKey, REF_NAME, type Ref, type RefInfo } from '@/lib/refs';

/** A referenced item as this reader sees it. `locked`: sealed, and this device can't open it. */
export type Resolved = RefInfo & { locked: boolean };

const TTL = 60_000;
const cache = new Map<string, { at: number; p: Promise<Resolved | null> }>();
const pending = new Map<number | string, Map<string, { resolve: (v: RefInfo | null) => void; reject: (e: unknown) => void }[]>>();
const keyCache = new Map<string, Promise<ItemKeys | null>>();

const cacheKey = (r: Ref) => `${r.society}|${refKey(r)}`;

function flush(society: number | string) {
  const batch = pending.get(society);
  pending.delete(society);
  if (!batch) return;
  const keys = [...batch.keys()];
  for (let i = 0; i < keys.length; i += 50) {
    const part = keys.slice(i, i + 50);
    fetch(`/api/societies/${society}/refs?r=${part.join(',')}`)
      .then(r => (r.ok ? r.json() : { items: {} }))
      .then((d: { items: Record<string, RefInfo> }) => {
        for (const k of part) for (const w of batch.get(k)!) w.resolve(d.items[k] ?? null);
      })
      .catch(e => { for (const k of part) for (const w of batch.get(k)!) w.reject(e); });
  }
}

function ask(r: Ref): Promise<RefInfo | null> {
  return new Promise((resolve, reject) => {
    let batch = pending.get(r.society);
    if (!batch) { batch = new Map(); pending.set(r.society, batch); setTimeout(() => flush(r.society), 0); }
    const k = refKey(r);
    batch.set(k, [...(batch.get(k) ?? []), { resolve, reject }]);
  });
}

/** This reader's keys for a sealed item (null: not unlocked here, or not theirs). */
export function keysForSealed(society: number, sealed: { type: string; id: string }): Promise<ItemKeys | null> {
  const k = `${society}|${sealed.type}|${sealed.id}`;
  let p = keyCache.get(k);
  if (!p) {
    p = secureAccessNow().then(a => a.status === 'ready' && a.identity
      ? keysFor(`/api/societies/${society}`, sealed.type, sealed.id, a.identity) : null).catch(() => null);
    keyCache.set(k, p);
    // Not unlocked yet: try again next time
    p.then(v => { if (!v) keyCache.delete(k); });
  }
  return p;
}

/** Open a sealed item's text fields in place (and say whether it could be opened). */
export async function openInfo<T extends { sealed: { type: string; id: string } | null; title: string }>(society: number, info: T, fields: (keyof T)[]): Promise<T & { locked: boolean }> {
  if (!info.sealed) return { ...info, locked: false };
  const keys = await keysForSealed(society, info.sealed);
  const out = { ...info } as T & { locked: boolean };
  let ok = !!keys;
  for (const f of ['title', ...fields] as (keyof T)[]) {
    const v = info[f];
    if (typeof v !== 'string' || !v.startsWith('sn1:')) continue;
    let opened: string | null = null;
    try { opened = keys ? openItemText(keys, v) : null; } catch { opened = null; }
    if (opened == null) ok = false;
    (out as Record<string, unknown>)[f as string] = opened;
  }
  out.locked = !ok;
  if (!ok) out.title = `Sealed ${REF_NAME[(info as unknown as RefInfo).kind] ?? 'item'}`;
  return out;
}

export function resolveRef(r: Ref, fresh = false): Promise<Resolved | null> {
  const k = cacheKey(r);
  const hit = cache.get(k);
  if (hit && !fresh && Date.now() - hit.at < TTL) return hit.p;
  const p = ask(r).then(info => info
    ? openInfo(info.society, info, ['description', 'url', 'file_name', 'location', 'first'])
    : null);
  p.catch(() => cache.delete(k));
  cache.set(k, { at: Date.now(), p });
  return p;
}

/** The chip's words for an item. */
export const refLabel = (v: Resolved | null | undefined) =>
  v === undefined ? '…' : v === null ? 'Item you can’t open' : v.title;
