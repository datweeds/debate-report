import { NextRequest, NextResponse } from 'next/server';
import { projectContext, readGroup } from '@/lib/projects';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string; pid: string }> };

// POST { name } — the PM or a moderator adds a Task Group.
async function handlePOST(req: NextRequest, { params }: Params) {
  const { id, pid } = await params;
  const c = await projectContext(req, id, pid);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!c.canManage) return NextResponse.json({ error: 'Only the Project Manager or a moderator can add groups' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const g = await readGroup(pid, c.a.societyId, c.me, { newGroup: b.name }, c);
  if (!g || 'error' in g || !g.id) return NextResponse.json({ error: 'A group name is required' }, { status: 400 });
  return NextResponse.json({ id: g.id }, { status: 201 });
}

export const POST = lockSafe(handlePOST);
