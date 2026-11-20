'use client';

// Shared bits for the Polls screens.

export { Badge, inputCls } from '@/components/projects/shared';

export const POLL_STATUS: Record<string, { label: string; cls: string }> = {
  draft:  { label: 'Draft',  cls: 'bg-slate-500/20 text-slate-300 border-slate-500/40' },
  open:   { label: 'Open',   cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
  closed: { label: 'Closed', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/40' },
};

export const fmtWhen = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

export const btn = 'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50';
export const btnPrimary = `${btn} bg-blue-600 text-white hover:bg-blue-500`;
export const btnGhost = `${btn} border border-slate-700 text-slate-200 hover:bg-slate-800`;
export const card = 'rounded-2xl border border-slate-800 bg-dr-card p-5';

const hex = (b: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');

/**
 * A vote receipt: a random secret kept by the voter. Only its SHA-256 hash is
 * sent with the ballot; the audit log lists every hash, so the voter can find
 * theirs without anyone else learning which ballot it is.
 */
export async function newReceipt(): Promise<{ receipt: string; hash: string }> {
  const secret = crypto.getRandomValues(new Uint8Array(16));
  return { receipt: hex(secret), hash: hex(await crypto.subtle.digest('SHA-256', secret)) };
}

export async function receiptHash(receipt: string): Promise<string | null> {
  const clean = receipt.trim().toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(clean)) return null;
  const bytes = new Uint8Array(clean.match(/../g)!.map(h => parseInt(h, 16)));
  return hex(await crypto.subtle.digest('SHA-256', bytes));
}

// Receipts are also remembered in this browser, for convenience only
const RECEIPTS = 'nv_poll_receipts';
export function rememberReceipt(pollId: string, receipt: string) {
  try {
    const all = JSON.parse(localStorage.getItem(RECEIPTS) ?? '{}');
    all[pollId] = [receipt, ...(all[pollId] ?? [])].slice(0, 10);
    localStorage.setItem(RECEIPTS, JSON.stringify(all));
  } catch { /* storage unavailable */ }
}
export function rememberedReceipts(pollId: string): string[] {
  try { return JSON.parse(localStorage.getItem(RECEIPTS) ?? '{}')[pollId] ?? []; } catch { return []; }
}

/** Shrink an image to fit within `max` pixels, as a JPEG data URL (kept inside the poll). */
export function resizeImage(file: File, max = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => reject(new Error('Not an image'));
    img.src = URL.createObjectURL(file);
  });
}

export const newId = () => Math.random().toString(36).slice(2, 10);

/** The same shuffle every time for one voter and question (so options don't jump around). */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
