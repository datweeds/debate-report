// Face-check providers (age estimation on the member's device). Pluggable: each
// provider is an adapter with the same shape, and a Sys Admin chooses one in
// Admin → Privacy → Age checks. Requirements for any real provider (see the proposal):
//   - estimation and liveness run on the device; no image ever leaves it
//   - every call goes through our server (relayBase), never straight to the provider
//   - the provider returns a result it has signed, which we verify here
//   - no account id, email or device id is ever sent: only a one-time token
// To add one: implement FaceProvider below, register it in PROVIDERS, put its
// secrets in .env.local (never in the database), and test it in test mode.
// Server-only.

export type FaceSession = {
  ref: string;                               // the provider's one-time session token
  client: Record<string, unknown>;           // what the browser needs to start the SDK (no secrets)
};
export type FaceResult = { estimatedAge: number; live: boolean };

export interface FaceProvider {
  id: string;
  label: string;
  /** Configured: its secrets are present. */
  ready(): boolean;
  /** Base URL that /api/age-check/relay forwards the SDK's calls to (none: no relay). */
  relayBase?: string;
  /** Start a check with the provider: one-time token, no account id. */
  start(): Promise<FaceSession>;
  /** Verify the provider's signed result for this session; throw if it isn't genuine. */
  result(session: FaceSession, payload: unknown): Promise<FaceResult>;
}

// Test provider: for trying the flow before a real provider is chosen. It makes
// no check at all (the tester types an age), so it only works for Sys Admins.
const test: FaceProvider = {
  id: 'test',
  label: 'Test (no real check; Sys Admins only)',
  ready: () => true,
  start: async () => ({ ref: crypto.randomUUID(), client: { kind: 'test' } }),
  result: async (_s, payload) => {
    const age = Number((payload as { age?: unknown })?.age);
    if (!Number.isFinite(age) || age < 5 || age > 100) throw new Error('Enter an age for the test');
    return { estimatedAge: age, live: true };
  },
};

export const PROVIDERS: FaceProvider[] = [test];
export const providerById = (id: string) => PROVIDERS.find(p => p.id === id) ?? null;
