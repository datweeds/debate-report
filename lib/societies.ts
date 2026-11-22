// Society visibility and membership (public / apply / invite). Server-only.

import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import pool from './db';
import { getSessionFromRequest, type SessionPayload } from './auth';
import { isSocietyModerator } from './roles';
import { featureOfApiPath } from './features';

export type SocietyVisibility = 'public' | 'apply' | 'invite';

export type SocietyAccess = {
  visibility: SocietyVisibility;
  isMember: boolean;
  isModerator: boolean;
  canEnter: boolean;     // may see the Society's dashboard and (subject to debate visibility) its debates
  canSeeTeaser: boolean; // may see its name, image and description (and ask to join, for 'apply')
  pendingRequest: boolean;
  breakGlass: string | null; // SysAdmin emergency access to a private Society: when it ends
  disabled: string[];        // features the Society has switched off (lib/features.ts)
  isDemo: boolean;           // the demo Society: everything readable, even without an account
  closed: boolean;           // closed by its moderators: only they can open it (to reopen it)
  held: boolean;             // read-only: its paid plan ended and it isn't one of its owner's 3 free Societies (lib/holds.ts)
};

export async function getSocietyAccess(session: SessionPayload | null, customerId: number): Promise<SocietyAccess | null> {
  const uid = session?.sub ?? null;
  const { rows: [row] } = await pool.query(
    `SELECT c.visibility, c.disabled_sections, c.is_demo, c.status, c.held_at,
            EXISTS (SELECT 1 FROM customer_members m WHERE m.customer_id = c.id AND m.user_id = $2) AS is_member,
            EXISTS (SELECT 1 FROM customer_roles r WHERE r.tenant_id = c.id AND r.user_id = $2 AND r.role = 'customer_admin') AS is_moderator,
            EXISTS (SELECT 1 FROM society_join_requests j WHERE j.customer_id = c.id AND j.user_id = $2 AND j.status = 'pending') AS pending,
            (SELECT max(g.expires_at) FROM sysadmin_access g WHERE g.customer_id = c.id AND g.user_id::text = $2
               AND g.ended_at IS NULL AND g.expires_at > now() AND $3::boolean) AS break_glass
     FROM customers c WHERE c.id = $1`,
    [customerId, uid, !!session?.isSysAdmin],
  );
  if (!row) return null;
  // A closed Society is gone for everyone but its moderators (even Sys Admin: they reopen it from Admin)
  if (row.status === 'closed' && !row.is_moderator) return null;
  const inside = row.is_member || row.is_moderator;
  // A SysAdmin may only look inside a private Society during a logged
  // emergency ("break-glass") grant: see lib/breakGlass.ts
  const breakGlass = row.visibility !== 'public' && !inside && row.break_glass ? new Date(row.break_glass).toISOString() : null;
  return {
    visibility: row.visibility,
    isMember: row.is_member,
    isModerator: row.is_moderator,
    canEnter: row.visibility === 'public' || inside || !!breakGlass,
    canSeeTeaser: row.visibility !== 'invite' || inside || !!breakGlass,
    pendingRequest: row.pending,
    breakGlass,
    disabled: row.disabled_sections ?? [],
    isDemo: !!row.is_demo,
    closed: row.status === 'closed',
    held: !!row.held_at,
  };
}

/**
 * SQL condition: the viewer may enter the Society the debate `res` belongs to
 * (public Society, or they are a member/moderator). Debates with no Society pass.
 * `uid` is the placeholder holding the viewer id as text, e.g. '$2::text'.
 */
export function societyOpenSql(res: string, uid: string): string {
  // A closed Society's debates are only for its moderators
  return `(${res}.customer_id IS NULL OR EXISTS (
    SELECT 1 FROM customers sx WHERE sx.id = ${res}.customer_id AND (
      (sx.status IS DISTINCT FROM 'closed' AND (
        sx.visibility = 'public'
        OR EXISTS (SELECT 1 FROM customer_members sm WHERE sm.customer_id = sx.id AND sm.user_id = ${uid})))
      OR EXISTS (SELECT 1 FROM customer_roles sr WHERE sr.tenant_id = sx.id AND sr.user_id = ${uid} AND sr.role = 'customer_admin'))))`;
}

export async function addMember(customerId: number, userId: string) {
  await pool.query(
    `INSERT INTO customer_members (customer_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [customerId, userId],
  );
}

// ── Invite links ─────────────────────────────────────────────────────────────

export function generateInviteToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export function hashInviteToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function lookupInvite(raw: string) {
  if (!raw || raw.length > 100) return null;
  const { rows: [inv] } = await pool.query(
    `SELECT i.id, i.customer_id, c.name AS society_name, c.hero_image, c.hero_text, c.description
     FROM society_invites i JOIN customers c ON c.id = i.customer_id
     WHERE i.token_hash = $1 AND i.revoked_at IS NULL
       AND (i.expires_at IS NULL OR i.expires_at > now())`,
    [hashInviteToken(raw)],
  );
  return inv ?? null;
}

export function slugify(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'society';
}

// For /api/manage/societies/[id]/* routes: the request's session and Society
// id when the caller moderates that Society, else null.
export async function moderatedSociety(req: NextRequest, params: Promise<{ id: string }>) {
  const session = await getSessionFromRequest(req);
  const id = parseInt((await params).id, 10);
  if (!session || isNaN(id) || !await isSocietyModerator(session, id)) return null;
  return { session, id };
}

// Who may read, contribute to and moderate a Society's content areas
// (Discussions, Documents, …). Contributing: anyone logged in for a public
// Society, members only for a private one.
export type SocietyContentAccess = {
  session: SessionPayload | null;
  societyId: number;
  canRead: boolean;      // anyone who can enter the Society
  canPost: boolean;      // logged in; members only in a private Society
  canModerate: boolean;  // the Society's moderators: pin, lock, delete any post
  canTakeDown: boolean;  // moderators, plus SysAdmin as the platform backstop (private Societies: only under break-glass)
  isMember: boolean;     // a member or moderator of this Society
  isDemo: boolean;       // the demo Society: discussions readable by anyone
  breakGlass: boolean;   // the viewer is a SysAdmin under emergency access
};

export async function societyContentAccess(req: NextRequest, rawId: string): Promise<SocietyContentAccess | null> {
  const societyId = parseInt(rawId, 10);
  if (isNaN(societyId)) return null;
  const session = await getSessionFromRequest(req);
  const access = await getSocietyAccess(session, societyId);
  if (!access || !access.canEnter) return null;
  // A feature the Society has switched off doesn't exist for anyone
  const feature = featureOfApiPath(req.nextUrl.pathname);
  if (feature && access.disabled.includes(feature)) return null;
  const inside = access.isMember || access.isModerator;
  return {
    session, societyId,
    canRead: true,
    canPost: !!session && (access.visibility === 'public' || inside),
    canModerate: access.isModerator,
    canTakeDown: access.isModerator || (!!session?.isSysAdmin && (access.visibility === 'public' || !!access.breakGlass)),
    isMember: inside,
    breakGlass: !!access.breakGlass,
    isDemo: access.isDemo,
  };
}
