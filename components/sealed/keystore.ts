// This device's copy of your unlocked secure-access key, so you enter your
// recovery phrase once per device. The key is kept in IndexedDB encrypted with
// a device key that the browser won't let any script read out (non-extractable).

const DB = 'newvote-sealed', STORE = 'keys';

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = f(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

type Saved = { deviceKey: CryptoKey; iv: Uint8Array; data: ArrayBuffer; publicKey: string };

export async function rememberKey(userId: string, privateKey: Uint8Array, publicKey: string) {
  const deviceKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, deviceKey, new Uint8Array(privateKey));
  await tx('readwrite', s => s.put({ deviceKey, iv, data, publicKey } satisfies Saved, userId));
}

/** The remembered private key, if it still matches this account's public key. */
export async function recallKey(userId: string, publicKey: string): Promise<Uint8Array | null> {
  try {
    const saved = await tx<Saved | undefined>('readonly', s => s.get(userId));
    if (!saved || saved.publicKey !== publicKey) return null;
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(saved.iv) }, saved.deviceKey, saved.data));
  } catch { return null; }
}

export async function forgetKey(userId: string) {
  try { await tx('readwrite', s => s.delete(userId)); } catch { /* nothing remembered */ }
}
