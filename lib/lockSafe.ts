import { NextResponse } from 'next/server';
import { isLockedError } from './masterKey';

// Wraps a route handler: if a private Society is locked (the master key
// hasn't been supplied since a restart), answer 503 with a clear message
// instead of failing.
export function lockSafe<A extends unknown[], R extends Response>(handler: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R | NextResponse> => {
    try {
      return await handler(...args);
    } catch (e) {
      // Text sealed (or not) when it shouldn't be: a clear message, not a crash
      if ((e as { code?: string })?.code === 'SEALED_TEXT') return NextResponse.json({ error: (e as Error).message }, { status: 400 });
      if (!isLockedError(e)) throw e;
      return NextResponse.json(
        { error: 'This private Society is locked for a moment: an administrator needs to unlock it. Please try again later.', locked: true },
        { status: 503 });
    }
  };
}
