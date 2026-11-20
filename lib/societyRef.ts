// A Society's web address: /society/<name>, where the name is the Society's
// unique `subdomain` (also used for <name>.new.vote). Numbered addresses
// (/society/12) keep working. Server-only.

import { cache } from 'react';
import { notFound } from 'next/navigation';
import pool from './db';

// 3–40 characters: lower-case letters, digits and hyphens; starts with a letter; no trailing or double hyphen
export const SLUG_RE = /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){2,39}$/;
const RESERVED = new Set(['new', 'admin', 'api', 'www', 'app', 'about', 'features', 'guides', 'help', 'login', 'register', 'pricing',
  'privacy', 'terms', 'support', 'contact', 'blog', 'society', 'societies', 'dashboard', 'sysadmin', 'chamber', 'poll', 'polls',
  'news', 'mail', 'static', 'assets', 'rtc', 'auth', 'id', 'chat', 'staging', 'test', 'root', 'settings', 'manage']);

/** Problem with a proposed name, or null if it's usable (availability is checked separately). */
export function slugProblem(slug: string): string | null {
  if (!SLUG_RE.test(slug)) return 'Use 3–40 lower-case letters, numbers and single hyphens, starting with a letter';
  if (RESERVED.has(slug)) return 'That name is reserved';
  return null;
}

/** A suggestion from a Society's name: "Scottish Parliament Monitor" → "scottish-parliament-monitor". */
export function suggestSlug(name: string): string {
  let s = name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!/^[a-z]/.test(s)) s = `society-${s}`;
  return s.slice(0, 40).replace(/-+$/, '');
}

export async function slugAvailable(slug: string, exceptId?: number): Promise<boolean> {
  const { rows } = await pool.query('SELECT 1 FROM customers WHERE subdomain = $1 AND id IS DISTINCT FROM $2', [slug, exceptId ?? null]);
  return rows.length === 0;
}

/** The Society id from an address segment: a number, or a Society's name. Null if there's no such Society. */
export const resolveSocietyId = cache(async (raw: string): Promise<number | null> => {
  const ref = decodeURIComponent(raw).toLowerCase();
  if (/^\d+$/.test(ref)) return Number(ref);
  const { rows: [r] } = await pool.query('SELECT id FROM customers WHERE subdomain = $1', [ref]);
  return r?.id ?? null;
});

/** For a Society page: the id behind its address, or a 404. */
export async function societyIdParam(raw: string): Promise<number> {
  const id = await resolveSocietyId(raw);
  if (id == null) notFound();
  return id;
}
