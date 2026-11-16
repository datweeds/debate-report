import { NextRequest, NextResponse } from 'next/server';
import { moderatedSociety } from '@/lib/societies';
import { accessLog } from '@/lib/breakGlass';

// GET — every Sys Admin emergency access to this Society. Its moderators.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await moderatedSociety(req, params);
  if (!ctx) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ log: await accessLog(ctx.id) });
}
