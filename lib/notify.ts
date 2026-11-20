// "Something new in your Society": notify its members' devices. Fire and forget:
// callers don't wait, and a failure never affects what was saved. Server-only.

import pool from './db';
import { pushToUsers, type PushKind } from './push';

const NOUN: Record<PushKind, string> = {
  discussions: 'discussion', messages: 'message', documents: 'document', events: 'event', projects: 'project',
  polls: 'poll', debates: 'debate', news: 'News edition', principles: 'principles version',
};

export type NewItem = {
  societyId: number; kind: PushKind; authorId: string | null; url: string;
  title?: string | null;        // shown only where the content is public
  private?: boolean;            // true: never show the title (e.g. discussions, sealed items)
  to?: string[];                // just these people (default: every member)
  heading?: string;             // instead of "New <kind> in <Society>"; {society} is replaced by its name
};

// Everyone who belongs to a Society (members and its admins)
async function membersOf(societyId: number): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT user_id::text AS id FROM customer_members WHERE customer_id = $1
     UNION SELECT user_id::text FROM customer_roles WHERE tenant_id = $1 AND role = 'customer_admin'`, [societyId]);
  return rows.map(r => r.id);
}

export function notifyNew(item: NewItem): void {
  void send(item).catch(err => console.error('[notify]', err));
}

async function send(item: NewItem) {
  const { rows: [s] } = await pool.query('SELECT name, visibility FROM customers WHERE id = $1', [item.societyId]);
  if (!s) return;
  const to = (item.to ?? await membersOf(item.societyId)).filter(id => id !== item.authorId);
  if (!to.length) return;
  const showTitle = !item.private && s.visibility === 'public' && !!item.title && !item.title.startsWith('sn1:');
  await pushToUsers(to, {
    title: item.heading?.replace('{society}', s.name) ?? `New ${NOUN[item.kind]} in ${s.name}`,
    body: showTitle ? item.title!.slice(0, 140) : 'Open new.vote to see it.',
    url: item.url,
    tag: `${item.societyId}:${item.kind}`,   // a newer notice of the same kind replaces the last
  }, { kind: item.kind, societyId: item.societyId });
}
