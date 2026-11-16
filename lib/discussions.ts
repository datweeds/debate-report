// Society Discussions: who may read, post and moderate. Server-only.

import { NextResponse } from 'next/server';
import type { SessionPayload } from './auth';
import { getSocietyAccess, societyContentAccess, type SocietyContentAccess } from './societies';

// The emoji people can react with (and pick from when writing).
export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🎉', '🤔', '✅'];

// Same rules as every Society content area (see societyContentAccess), except
// that reading discussions is for members only.
export type DiscussionAccess = SocietyContentAccess;
export const discussionAccess = societyContentAccess;

/** The answer for non-members: what to show instead, and how to join. */
export async function membersOnly(societyId: number, session: SessionPayload | null) {
  const access = await getSocietyAccess(session, societyId);
  return NextResponse.json({
    error: 'Become a member to view discussions', membersOnly: true,
    visibility: access?.visibility ?? 'public', pending: access?.pendingRequest ?? false,
  }, { status: 403 });
}

export const UUID_RE = /^[0-9a-f-]{36}$/i;
