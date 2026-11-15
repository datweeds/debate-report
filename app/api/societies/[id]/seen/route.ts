import { NextRequest, NextResponse } from 'next/server';
import { societyContentAccess } from '@/lib/societies';
import { markSeen, SECTIONS, type Section } from '@/lib/unread';

// POST { section } — the viewer has just looked at this section of the Society.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a?.session) return NextResponse.json({ ok: false });
  const { section } = await req.json().catch(() => ({}));
  if (!(SECTIONS as readonly string[]).includes(section)) return NextResponse.json({ error: 'Unknown section' }, { status: 400 });
  await markSeen(a.session.sub, a.societyId, section as Section);
  return NextResponse.json({ ok: true });
}
