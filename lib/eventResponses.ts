// Members' responses to events, and what each viewer may see of them. Server-only.
import pool from './db';
import { eventOver, type Responses, type ResponseVisibility } from './events';

type Viewer = { me: string | null; isMember: boolean; canModerate: boolean };
export type ResponseEvent = {
  id: string; created_by: string | null; response_visibility: ResponseVisibility;
  starts_at: Date; ends_at: Date | null; all_day: boolean;
};

// The author and moderators always see who's responded. Other members see
// names when the author allows it, or just the numbers; people outside the
// Society (public Societies) see the numbers at most, never names.
export async function responsesFor(events: ResponseEvent[], v: Viewer): Promise<Map<string, Responses>> {
  const out = new Map<string, Responses>();
  const asking = events.filter(e => e.response_visibility !== 'off');
  if (!asking.length) return out;
  const { rows } = await pool.query(
    `SELECT r.event_id, r.user_id, r.response, u.user_handle AS handle
     FROM event_responses r JOIN users u ON u.id = r.user_id
     WHERE r.event_id = ANY($1::uuid[]) ORDER BY r.updated_at`,
    [asking.map(e => e.id)]);
  for (const e of asking) {
    const all = rows.filter(r => r.event_id === e.id);
    const going = all.filter(r => r.response === 'going'), notGoing = all.filter(r => r.response === 'not_going');
    const isAuthor = !!v.me && e.created_by === v.me;
    const names = !!v.me && (isAuthor || v.canModerate || (v.isMember && e.response_visibility === 'all'));
    const counts = names || e.response_visibility !== 'author';
    const over = eventOver(e);
    out.set(e.id, {
      visibility: e.response_visibility,
      mine: (v.me && all.find(r => r.user_id === v.me)?.response) || null,
      going: counts ? going.length : null,
      notGoing: counts ? notGoing.length : null,
      names: names ? { going: going.map(r => r.handle ?? 'member'), notGoing: notGoing.map(r => r.handle ?? 'member') } : null,
      canRespond: !!v.me && v.isMember && !over,
      over, isAuthor,
    });
  }
  return out;
}
