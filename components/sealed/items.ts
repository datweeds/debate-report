'use client';

// Sealed discussion threads in the browser: unlocking their keys, sharing them
// with members who don't have them yet, starting a new key when someone has
// left, and sealing a new thread.

import {
  fromB64, itemAad, lockFor, newItemKey, openTextE2E, sealTextE2E, unlockMine, type Identity,
} from '@/lib/sealed/core';

export type SealedMember = { user_id: string; handle: string; name: string | null; public_key: string | null; epochs?: number[] };
export type ItemKeys = { keys: Map<number, Uint8Array>; epoch: number; members: SealedMember[]; type: string; id: string };
export type ThreadKeys = ItemKeys;

const aadOf = (threadId: string) => itemAad('thread', threadId);

async function postLocks(base: string, body: object): Promise<boolean> {
  const r = await fetch(`${base}/sealed`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.ok;
}

const locksFor = (members: SealedMember[], key: Uint8Array, aad: string) =>
  members.filter(m => m.public_key).map(m => ({ userId: m.user_id, lockedKey: lockFor(fromB64(m.public_key!), key, aad) }));

/**
 * One sealed thread's keys for this person. While here, quietly share every
 * key this person holds with members who don't have it yet, and if someone who
 * has left still holds the current key, start a new one for those who remain.
 */
export const threadKeys = (base: string, threadId: string, me: Identity) => keysFor(base, 'thread', threadId, me);

/** Any sealed item's keys (a thread, the calendar, a project…), sharing and renewing them as needed. */
export async function keysFor(base: string, type: string, id: string, me: Identity): Promise<ItemKeys> {
  const r = await fetch(`${base}/sealed?type=${type}&id=${id}`);
  if (!r.ok) throw new Error('Couldn’t load the keys');
  const d = await r.json() as { epoch: number; mine: { epoch: number; lockedKey: string }[]; members: SealedMember[]; needsNewEpoch: boolean };
  const threadId = id;
  const aad = itemAad(type, id);
  const keys = new Map<number, Uint8Array>();
  for (const m of d.mine) { try { keys.set(m.epoch, unlockMine(me, m.lockedKey, aad)); } catch { /* not for this key */ } }

  for (const [epoch, key] of keys) {
    const missing = d.members.filter(m => m.public_key && !(m.epochs ?? []).includes(epoch));
    if (missing.length) await postLocks(base, { type, id: threadId, epoch, locks: locksFor(missing, key, aad) });
  }
  let epoch = d.epoch;
  if (d.needsNewEpoch && keys.has(epoch)) {
    const fresh = newItemKey();
    if (await postLocks(base, { type, id: threadId, epoch: epoch + 1, newEpoch: true, locks: locksFor(d.members, fresh, aad) })) {
      epoch += 1;
      keys.set(epoch, fresh);
    }
  }
  return { keys, epoch, members: d.members, type, id };
}

/** Open or seal text belonging to a sealed item (null: no key for it). */
export const openItemText = (k: ItemKeys | null | undefined, v: string | null | undefined): string | null =>
  v == null ? null : !v.startsWith('sn1:') ? v : k ? openTextE2E(k.keys, v, itemAad(k.type, k.id)) : null;
export const sealItemText = (k: ItemKeys, text: string) => sealTextE2E(k.keys, k.epoch, text, itemAad(k.type, k.id));
export const sealItemTextOrNull = (k: ItemKeys, text: string | null | undefined) => text ? sealItemText(k, text) : null;

/** The Society's members (with their public keys, for sealing something new for them). */
export async function societyMembers(base: string): Promise<{ members: SealedMember[]; allowSealed: boolean }> {
  const r = await fetch(`${base}/sealed`);
  if (!r.ok) return { members: [], allowSealed: false };
  const d = await r.json();
  return { members: d.members ?? [], allowSealed: !!d.allowSealed };
}

/** A brand-new item key, locked for every member with secure access. */
export function newItemKeys(type: string, id: string, members: SealedMember[]): { keys: ItemKeys; locks: { userId: string; lockedKey: string }[] } {
  const key = newItemKey();
  return {
    keys: { keys: new Map([[1, key]]), epoch: 1, members, type, id },
    locks: locksFor(members, key, itemAad(type, id)),
  };
}

/** This person's keys for every sealed thread in a Society, to show their titles. */
export async function allThreadKeys(base: string, me: Identity) {
  const r = await fetch(`${base}/sealed`);
  if (!r.ok) return { byThread: new Map<string, Map<number, Uint8Array>>(), members: [] as SealedMember[] };
  const d = await r.json() as { threads: Record<string, { epoch: number; lockedKey: string }[]>; members: SealedMember[] };
  const byThread = new Map<string, Map<number, Uint8Array>>();
  for (const [id, locks] of Object.entries(d.threads)) {
    const keys = new Map<number, Uint8Array>();
    for (const l of locks) { try { keys.set(l.epoch, unlockMine(me, l.lockedKey, aadOf(id))); } catch { /* skip */ } }
    byThread.set(id, keys);
  }
  return { byThread, members: d.members };
}

export const openThreadText = (keys: Map<number, Uint8Array> | undefined, threadId: string, v: string) =>
  keys ? openTextE2E(keys, v, aadOf(threadId)) : null;

export const sealThreadText = (k: ThreadKeys, threadId: string, text: string) =>
  sealTextE2E(k.keys, k.epoch, text, aadOf(threadId));

/** A new sealed thread: its id, title and first message sealed, and its key locked for every member with secure access. */
export function newSealedThread(members: SealedMember[], title: string, body: string) {
  const id = crypto.randomUUID();
  const key = newItemKey();
  const keys = new Map([[1, key]]);
  const aad = aadOf(id);
  return {
    protection: 'sealed' as const, id,
    title: sealTextE2E(keys, 1, title, aad), body: sealTextE2E(keys, 1, body, aad),
    locks: locksFor(members, key, aad),
  };
}

/** This person's keys for every sealed item of one kind in a Society, opened, by item id (for lists). */
export async function listKeys(base: string, type: 'project' | 'folder' | 'poll', me: Identity): Promise<Map<string, ItemKeys>> {
  const out = new Map<string, ItemKeys>();
  const r = await fetch(`${base}/sealed?list=${type}`);
  if (!r.ok) return out;
  const { items } = await r.json() as { items: Record<string, { epoch: number; lockedKey: string }[]> };
  for (const [id, locks] of Object.entries(items)) {
    const keys = new Map<number, Uint8Array>();
    for (const l of locks) { try { keys.set(l.epoch, unlockMine(me, l.lockedKey, itemAad(type, id))); } catch { /* skip */ } }
    out.set(id, { keys, epoch: Math.max(1, ...keys.keys()), members: [], type, id });
  }
  return out;
}
