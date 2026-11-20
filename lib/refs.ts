// References: links from one item in a Society to another (a note, a file or
// link, an event, a discussion). A reference is just the item's own address,
// so it works anywhere a link does; new.vote shows it as a named chip that
// opens a read-only preview. Only ids are in the address, never titles.
// Shared by the server and the browser.

export type RefKind = 'note' | 'doc' | 'event' | 'thread';
// society: its number, or its name as it appears in addresses ('/society/<name>/…')
export type Ref = { society: number | string; kind: RefKind; id: string };

export const REF_KINDS: RefKind[] = ['note', 'doc', 'event', 'thread'];
export const REF_ICON: Record<RefKind, string> = { note: '📝', doc: '📄', event: '📅', thread: '💬' };
export const REF_NAME: Record<RefKind, string> = { note: 'note', doc: 'document', event: 'event', thread: 'discussion' };

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UUID_ONLY = new RegExp(`^${UUID}$`, 'i');
export const isRefId = (v: unknown): v is string => typeof v === 'string' && UUID_ONLY.test(v);

// The sites new.vote is served from (and this browser's own address)
const HOSTS = new Set(['new.vote', 'www.new.vote', 'debate.report', 'www.debate.report', 'staging.debate.report']);

/** The item's address on this site. */
export function refPath(r: Ref): string {
  const s = `/society/${r.society}`;
  switch (r.kind) {
    case 'note': return `${s}/documents?note=${r.id}`;
    case 'doc': return `${s}/documents?doc=${r.id}`;
    case 'event': return `${s}/events?event=${r.id}`;
    case 'thread': return `${s}/discussions/${r.id}`;
  }
}

/** The full address, to paste anywhere. */
export const refUrl = (r: Ref) =>
  (typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_BASE_URL ?? 'https://new.vote')) + refPath(r);

/** A reference, if this address is one (relative, or on one of new.vote's own sites). */
export function parseRef(href: string): Ref | null {
  let u: URL;
  try { u = new URL(href, 'https://new.vote'); } catch { return null; }
  const own = !/^[a-z]+:/i.test(href) && !href.startsWith('//')
    || HOSTS.has(u.host) || (typeof window !== 'undefined' && u.host === window.location.host);
  if (!own || !/^https?:$/.test(u.protocol)) return null;
  const m = u.pathname.match(/^\/society\/([a-z0-9][a-z0-9-]{0,59})\/(documents|events|discussions)(?:\/([^/]+))?\/?$/i);
  if (!m) return null;
  const society = /^\d+$/.test(m[1]) ? Number(m[1]) : m[1].toLowerCase();
  const q = u.searchParams;
  if (m[2] === 'documents' && !m[3]) {
    if (isRefId(q.get('note'))) return { society, kind: 'note', id: q.get('note')!.toLowerCase() };
    if (isRefId(q.get('doc'))) return { society, kind: 'doc', id: q.get('doc')!.toLowerCase() };
  }
  if (m[2] === 'events' && !m[3] && isRefId(q.get('event'))) return { society, kind: 'event', id: q.get('event')!.toLowerCase() };
  if (m[2] === 'discussions' && isRefId(m[3])) return { society, kind: 'thread', id: m[3].toLowerCase() };
  return null;
}

export const refKey = (r: { kind: RefKind; id: string }) => `${r.kind}:${r.id}`;

/** What the server says about a referenced item (text may still be sealed: "sn1:…"). */
export type RefInfo = {
  society: number;   // the Society's number (a reference may have used its name)
  kind: RefKind; id: string;
  title: string;
  sealed: { type: string; id: string } | null;   // the sealed item whose key opens its text
  created_at: string; author: string | null;
  // documents
  docKind?: 'file' | 'link' | 'note'; description?: string | null; url?: string | null;
  file_name?: string | null; mime_type?: string | null; size_bytes?: number | null; folder_id?: string | null;
  // events
  starts_at?: string; ends_at?: string | null; all_day?: boolean; location?: string | null;
  // discussions
  posts?: number; first?: string | null; locked?: boolean;
};
