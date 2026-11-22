import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { entitlementsFor, poolUsage } from '@/lib/plans';
import { warningsFor } from '@/lib/holds';

// GET — the Society's plan (its owner's), the owner's shared usage, and
// whether it's read-only. Society Admins.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const e = await entitlementsFor(a.societyId);
  const [u, { rows: [c] }] = await Promise.all([poolUsage(e.pool), pool.query('SELECT held_at FROM customers WHERE id = $1', [a.societyId])]);
  return NextResponse.json({
    plan: e.plan, name: e.name, source: e.source, until: e.until, limits: e.limits, enforced: e.enforced,
    ownerHandle: e.ownerHandle, isOwner: !!e.ownerId && e.ownerId === a.session?.sub,
    held: !!c?.held_at, warnings: e.enforced ? await warningsFor(a.societyId) : [],
    usage: { storageBytes: u.storage, aiUsd: u.ai, societies: u.societies.length },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
