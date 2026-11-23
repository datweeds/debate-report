import fs from 'fs';
import os from 'os';
import path from 'path';
import pool from './db';
import { isUnlocked } from './masterKey';

// The public status page: live checks of each part of the service, and the
// incidents and maintenance Sys Admin posts. The page runs on the same server,
// so if the server is down it can't load; an outside monitor covers that.
export type Health = 'ok' | 'degraded' | 'down';
export type Check = { key: string; name: string; what: string; health: Health; note?: string };

const timed = async <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);

async function probe(url: string, ms = 2500): Promise<boolean> {
  try { const r = await timed(fetch(url, { cache: 'no-store' }), ms); return r.status < 500; } catch { return false; }
}

function backupOk(): boolean | null {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config', 'backup', 'status.json'), 'utf8'));
    return !!s.ok && Date.now() - new Date(s.at).getTime() < 36 * 3600e3;
  } catch { return null; }
}

export async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [{ key: 'site', name: 'Website and app', what: 'Pages, debates, discussions, polls and documents', health: 'ok' }];
  try { await timed(pool.query('SELECT 1'), 2500); checks.push({ key: 'db', name: 'Database', what: 'Saving and loading everything', health: 'ok' }); }
  catch { checks.push({ key: 'db', name: 'Database', what: 'Saving and loading everything', health: 'down' }); }
  checks.push(isUnlocked()
    ? { key: 'private', name: 'Private Societies', what: 'Encrypted content in private Societies', health: 'ok' }
    : { key: 'private', name: 'Private Societies', what: 'Encrypted content in private Societies', health: 'degraded', note: 'Locked after a restart until an administrator unlocks them; nothing is lost' });
  const scanner = process.env.SCANNER_URL;
  if (scanner) {
    let health: Health = 'down';
    try {
      const r = await timed(fetch(`${scanner}/health`, { cache: 'no-store' }), 2500);
      const j = await r.json() as { detoxify?: boolean; images?: boolean };
      health = j.detoxify && j.images ? 'ok' : 'degraded';
    } catch { /* down */ }
    checks.push({ key: 'scanner', name: 'Safety scanning', what: 'Checking new text and uploaded images', health,
      note: health === 'ok' ? undefined : 'New posts and uploads still work; they are checked when scanning returns' });
  }
  const lk = process.env.LIVEKIT_API_URL;
  if (lk) {
    const up = await probe(lk);
    checks.push({ key: 'calls', name: 'Video calls (Meet)', what: 'Joining and running calls', health: up ? 'ok' : 'down' });
  }
  const b = backupOk();
  if (b !== null) checks.push({ key: 'backups', name: 'Backups', what: 'Nightly encrypted backups', health: b ? 'ok' : 'degraded',
    note: b ? undefined : 'Last night’s backup didn’t complete; your data is unaffected' });
  return checks;
}

export type Incident = { id: number; title: string; body: string; impact: string; state: string; started_at: string; resolved_at: string | null; updated_at: string };

export async function incidents(): Promise<{ open: Incident[]; recent: Incident[] }> {
  const { rows } = await pool.query<Incident>(
    `SELECT id, title, body, impact, state, started_at, resolved_at, updated_at FROM status_incidents
     WHERE resolved_at IS NULL OR resolved_at > now() - interval '30 days' ORDER BY started_at DESC`);
  return { open: rows.filter(r => !r.resolved_at), recent: rows.filter(r => r.resolved_at) };
}
