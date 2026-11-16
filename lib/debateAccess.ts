import pool from './db';
import type { SessionPayload } from './auth';
import { isCustomerAdmin } from './roles';
import { getAccessKeyFromCookies } from './accessKeys';
import { getSocietyAccess, societyOpenSql } from './societies';

export type VisibilityDebate = {
  id: string;
  customer_id: number | null;
  created_by: string | null;
  debate_visibility: string; // 'public' | 'apply' | 'invite'
};

export type DebateAccess = { listable: boolean; viewable: boolean };

async function isSocietyMember(userId: string, customerId: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM customer_members WHERE customer_id = $1 AND user_id = $2 LIMIT 1`,
    [customerId, userId]
  );
  return rows.length > 0;
}

async function isActiveDebateMember(userId: string, resolutionId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM debate_members WHERE resolution_id = $1 AND user_id = $2 AND member_status = 'active' LIMIT 1`,
    [resolutionId, userId]
  );
  return rows.length > 0;
}

// Single source of truth for "who can see/open this debate", replacing the
// old per-route forum logic. `apply` and `invite` both gate viewing on an
// active debate_members row — they only differ in how that row gets created
// (self-serve request+approval vs. an issued invite+acceptance) and in who
// sees it listed in the first place (any Society member, vs. only the invitee).
export async function getDebateAccess(
  session: SessionPayload | null,
  debate: VisibilityDebate,
): Promise<DebateAccess> {
  const userId = session?.sub ?? null;
  const everything: DebateAccess = { listable: true, viewable: true };
  const nothing: DebateAccess = { listable: false, viewable: false };

  // SysAdmin sees everything as the platform's takedown backstop, except in a
  // private Society, where only an emergency (break-glass) grant lets them in
  if (session?.isSysAdmin) {
    if (debate.customer_id == null) return everything;
    const s = await getSocietyAccess(session, debate.customer_id);
    if (!s || s.visibility === 'public' || s.breakGlass) return everything;
  }
  if (userId && debate.created_by === userId) return everything;
  if (userId && debate.customer_id != null && await isCustomerAdmin(userId, debate.customer_id)) return everything;

  // An Access Key (SysAdmin-issued, held in a cookie) unlocks the debates it
  // was issued for — read-only by nature, since its holder isn't logged in.
  const key = await getAccessKeyFromCookies();
  if (key?.resolutionIds.has(debate.id)) return everything;

  // Debates in an Apply or Invite Society are only for its members
  if (debate.customer_id != null) {
    const society = await getSocietyAccess(session, debate.customer_id);
    if (society && !society.canEnter) return nothing;
  }

  if (debate.debate_visibility === 'public') return everything;

  if (debate.debate_visibility === 'apply') {
    const isMember = userId && debate.customer_id != null && await isSocietyMember(userId, debate.customer_id);
    if (!isMember) return nothing;
    const active = userId ? await isActiveDebateMember(userId, debate.id) : false;
    return { listable: true, viewable: active };
  }

  // invite — not generally listed to Society members, only to the invitee
  const active = userId ? await isActiveDebateMember(userId, debate.id) : false;
  return { listable: active, viewable: active };
}

// ── SQL twins of getDebateAccess, for list/feed queries ─────────────────────
// `res` is the SQL alias of the resolution row; `uid` is a placeholder holding
// the viewer's user id as text, e.g. '$2::text' (NULL when logged out, which
// makes every per-user clause false). SysAdmins see everything — callers
// should skip the filter for them rather than pass it here.

function staffSql(res: string, uid: string): string {
  return `${res}.created_by::text = ${uid}
    OR EXISTS (SELECT 1 FROM customer_roles cr
               WHERE cr.tenant_id = ${res}.customer_id AND cr.user_id = ${uid} AND cr.role = 'customer_admin')`;
}

function debateMemberSql(res: string, uid: string): string {
  return `EXISTS (SELECT 1 FROM debate_members dm
                  WHERE dm.resolution_id = ${res}.id AND dm.user_id = ${uid} AND dm.member_status = 'active')`;
}

/** SQL condition: the viewer may open this debate (= getDebateAccess().viewable). */
export function viewableResolutionSql(res: string, uid: string): string {
  return `(${staffSql(res, uid)} OR (${societyOpenSql(res, uid)} AND (
    ${res}.debate_visibility = 'public' OR ${debateMemberSql(res, uid)})))`;
}

/** SQL condition: the debate may be listed to the viewer (= getDebateAccess().listable). */
export function listableResolutionSql(res: string, uid: string): string {
  return `(${staffSql(res, uid)} OR (${societyOpenSql(res, uid)} AND (
    ${res}.debate_visibility = 'public' OR ${debateMemberSql(res, uid)}
    OR (${res}.debate_visibility = 'apply' AND EXISTS (SELECT 1 FROM customer_members cm
         WHERE cm.customer_id = ${res}.customer_id AND cm.user_id = ${uid})))))`;
}
