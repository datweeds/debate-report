// Slows down password and access-code guessing (Cyber Essentials: brute-force
// protection). Failed sign-ins are counted per account name and per network
// address over a 15-minute window; past the limit, sign-in is refused until
// the window has passed. Kept in memory: the app runs as one process.

const WINDOW = 15 * 60_000;
const PER_ACCOUNT = 10, PER_ADDRESS = 50;
const fails = new Map<string, number[]>();

const recent = (key: string) => (fails.get(key) ?? []).filter(t => Date.now() - t < WINDOW);

/** Minutes to wait before trying again, or 0 if sign-in may be tried now. */
export function loginBlocked(account: string, address: string): number {
  const keys: [string, number][] = [[`a:${account.toLowerCase()}`, PER_ACCOUNT]];
  if (address !== 'unknown') keys.push([`ip:${address}`, PER_ADDRESS]);
  for (const [key, limit] of keys) {
    const r = recent(key);
    if (r.length >= limit) return Math.max(1, Math.ceil((r[0] + WINDOW - Date.now()) / 60_000));
  }
  return 0;
}

export function loginFailed(account: string, address: string) {
  for (const key of [`a:${account.toLowerCase()}`, ...(address !== 'unknown' ? [`ip:${address}`] : [])]) fails.set(key, [...recent(key), Date.now()]);
  if (fails.size > 50_000) for (const [k] of fails) { if (!recent(k).length) fails.delete(k); }
}

export function loginSucceeded(account: string) { fails.delete(`a:${account.toLowerCase()}`); }

/** The caller's address, as nginx passes it on (X-Real-IP is set from the connection, so it can't be faked). */
export const clientAddress = (h: Headers) => h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
