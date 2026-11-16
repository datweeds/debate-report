import { NextResponse } from 'next/server';
import { keyHeldOffline } from '@/lib/masterKey';

// GET — public: is the master key kept off our servers? The privacy wording depends on it.
export async function GET() {
  return NextResponse.json({ keyOffline: keyHeldOffline() }, { headers: { 'Cache-Control': 'no-store' } });
}
