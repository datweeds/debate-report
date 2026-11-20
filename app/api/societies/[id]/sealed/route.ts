import { NextRequest, NextResponse } from 'next/server';
import { discussionAccess } from '@/lib/discussions';
import { addLocks, allowsSealed, itemKeys, myKeysOfType, myThreadKeys, readLocks, sealedMembers, sealedItem, sealedSection } from '@/lib/sealed/server';

type Params = { params: Promise<{ id: string }> };

// GET ?thread=<id> — that sealed thread's keys as you see them (yours, who
//     holds what, whether a new epoch is due).
// GET — your keys for every sealed thread here, the members' public keys (to
//     seal a new thread for them), and whether the Society allows Sealed.
export async function GET(req: NextRequest, { params }: Params) {
  const a = await discussionAccess(req, (await params).id);
  if (!a?.session || (!a.isMember && !a.canModerate)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // ?thread=<id>, or ?type=<calendar|principles|debates|project|folder|poll|thread>&id=<id>
  const q = req.nextUrl.searchParams;
  const threadId = q.get('thread');
  const type = threadId ? 'thread' : q.get('type'), itemId = threadId ?? q.get('id');
  if (type && itemId) {
    const item = await sealedItem(a.societyId, type, itemId);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(await itemKeys(item, a.session.sub));
  }
  // ?list=project|folder|poll: your keys for every sealed item of that kind here
  const list = q.get('list');
  if (list === 'project' || list === 'folder' || list === 'poll') {
    return NextResponse.json({ items: await myKeysOfType(a.societyId, a.session.sub, list) });
  }
  const [threads, members, allowed, debates] = await Promise.all([
    myThreadKeys(a.societyId, a.session.sub), sealedMembers(a.societyId), allowsSealed(a.societyId), sealedSection(a.societyId, 'debates')]);
  return NextResponse.json({ threads, members, allowSealed: allowed, debates: debates && { id: debates.id, epoch: debates.epoch } });
}

// POST { thread | type+id, epoch, locks: [{ userId, lockedKey }], newEpoch? } — share a
// sealed item's key with members (locked for each), or start a new epoch.
export async function POST(req: NextRequest, { params }: Params) {
  const a = await discussionAccess(req, (await params).id);
  if (!a?.session || (!a.isMember && !a.canModerate)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const item = typeof b.thread === 'string' ? await sealedItem(a.societyId, 'thread', b.thread)
    : typeof b.type === 'string' && typeof b.id === 'string' ? await sealedItem(a.societyId, b.type, b.id) : null;
  const locks = readLocks(b.locks);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!locks || typeof b.epoch !== 'number') return NextResponse.json({ error: 'Those keys weren’t understood' }, { status: 400 });
  const problem = await addLocks(item, b.epoch, a.session.sub, locks, b.newEpoch === true);
  if (problem) return NextResponse.json({ error: problem }, { status: 409 });
  return NextResponse.json({ ok: true });
}
