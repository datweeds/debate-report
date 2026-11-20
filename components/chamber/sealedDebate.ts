'use client';

// Sealed debates in the browser. When a Society seals its debates, everything
// written in them (arguments, chat, reasons for votes, closing statements) is
// encrypted here with the Society's debate keys before it's sent, and opened
// here when it arrives. The Chamber shows one debate at a time, so the keys
// for it are kept in this module for every component to use.

import { keysFor, openItemText, sealItemText, type ItemKeys } from '@/components/sealed/items';
import { secureAccessNow } from '@/components/sealed/useSecureAccess';
import type { ChamberData } from './types';

export const SEALED_TEXT = '🔐 Sealed';

let sealed = false;
let keys: ItemKeys | null = null;
// Each statement's title exactly as stored, so an unchanged title can be sent back as it is
const storedTitles = new Map<string, string>();

/** The keys for one Society's sealed debates (shared with members who lack them, as with other sealed items). */
export async function debateKeys(societyId: number, sealedId: string): Promise<ItemKeys | null> {
  const access = await secureAccessNow();
  if (!access.identity) return null;
  if (keys?.id === sealedId) return keys;
  try { return await keysFor(`/api/societies/${societyId}`, 'debates', sealedId, access.identity); } catch { return null; }
}

/** Text from a sealed debate, opened (a placeholder without the key); other text as it is. */
export const openDebateText = <T extends string | null | undefined>(v: T): T =>
  (typeof v === 'string' && v.startsWith('sn1:') ? openItemText(keys, v) ?? SEALED_TEXT : v) as T;

/** Text to send: sealed when the current debate is. Throws without the key. */
export function sealDebateText(text: string): string {
  if (!sealed || !text) return text;
  if (!keys?.keys.has(keys.epoch)) throw new Error('This debate is sealed: you need access to its key to write here');
  return sealItemText(keys, text);
}
export const sealDebateTextOrNull = (text: string | null | undefined) => (text ? sealDebateText(text) : null);

/** A statement's title to send: as stored when unchanged (sealed titles differ every time they're sealed). */
export function titleToSend(id: string, title: string, original: string): string {
  if (sealed && title === original && storedTitles.has(id)) return storedTitles.get(id)!;
  return sealDebateText(title);
}
export const rememberStoredTitle = (id: string, stored: string) => { if (stored.startsWith('sn1:')) storedTitles.set(id, stored); };

/** A debate as loaded from /api/chamber/[id]: opened, ready to show, with this debate's keys made current. */
export async function openChamber(d: ChamberData): Promise<ChamberData> {
  sealed = !!d.sealed;
  storedTitles.clear();
  if (!d.sealed || d.resolution.customer_id == null) { keys = null; return d; }
  keys = await debateKeys(d.resolution.customer_id, d.sealed.id);
  const r = d.resolution;
  rememberStoredTitle(r.id, r.stat_title);
  for (const s of d.statements) rememberStoredTitle(s.id, s.stat_title);
  return {
    ...d,
    canWriteSealed: !!keys?.keys.has(keys.epoch),
    resolution: { ...r, stat_title: openDebateText(r.stat_title), stat_description: openDebateText(r.stat_description), closing_statement: openDebateText(r.closing_statement) },
    statements: d.statements.map(s => ({ ...s, stat_title: openDebateText(s.stat_title), stat_description: openDebateText(s.stat_description) })),
  };
}

/** Load a debate for the Chamber, opened. */
export async function fetchChamber(resolutionId: string): Promise<{ status: number; data: ChamberData | null; body: Record<string, unknown> }> {
  const r = await fetch(`/api/chamber/${resolutionId}`);
  const body = await r.json().catch(() => ({}));
  return { status: r.status, data: r.ok ? await openChamber(body as ChamberData) : null, body };
}

/** Debate titles in a list (the Switchboard, a Society's debates), opened with each sealed Society's keys. */
export async function openDebateTitles<T extends { stat_title: string; customer_id: number | null; sealed_id?: string | null }>(rows: T[]): Promise<T[]> {
  const bySociety = new Map<number, string>();
  for (const r of rows) if (r.sealed_id && r.customer_id != null) bySociety.set(r.customer_id, r.sealed_id);
  if (!bySociety.size) return rows;
  const found = new Map<number, ItemKeys | null>();
  for (const [cid, sid] of bySociety) found.set(cid, await debateKeys(cid, sid));
  return rows.map(r => r.stat_title.startsWith('sn1:')
    ? { ...r, stat_title: openItemText(found.get(r.customer_id!) ?? null, r.stat_title) ?? `${SEALED_TEXT} debate` }
    : r);
}

/**
 * For writing a debate's text outside the Chamber (a new debate, editing one):
 * a function that seals text for the Society if its debates are sealed, or
 * leaves it as it is. Throws if they're sealed and this browser lacks the key.
 */
export async function societyDebateSealer(societyId: number): Promise<{ sealed: boolean; seal: (t: string) => string; open: <T extends string | null | undefined>(v: T) => T }> {
  const r = await fetch(`/api/societies/${societyId}/sealed`);
  const d = r.ok ? await r.json() : {};
  if (!d.debates) return { sealed: false, seal: t => t, open: v => v };
  const k = await debateKeys(societyId, d.debates.id);
  if (!k?.keys.has(k.epoch)) throw new Error('This Society’s debates are sealed: set up or unlock secure access (or wait for a member to share the key) to write in them');
  return {
    sealed: true,
    seal: t => (t ? sealItemText(k, t) : t),
    open: <T extends string | null | undefined>(v: T) => (typeof v === 'string' && v.startsWith('sn1:') ? openItemText(k, v) ?? SEALED_TEXT : v) as T,
  };
}
