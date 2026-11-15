import { NextRequest, NextResponse } from 'next/server';
import { societyContentAccess } from '@/lib/societies';
import { unreadCounts } from '@/lib/unread';

// GET — new items per section of this Society since the viewer last looked.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a?.session) return NextResponse.json({ counts: {} });
  const counts = (await unreadCounts(a.session.sub, [a.societyId])).get(a.societyId);
  return NextResponse.json({ counts });
}
