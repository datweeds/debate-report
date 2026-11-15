// Society Discussions: who may read, post and moderate. Server-only.

import { societyContentAccess, type SocietyContentAccess } from './societies';

// The emoji people can react with (and pick from when writing).
export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🎉', '🤔', '✅'];

// Same rules as every Society content area (see societyContentAccess).
export type DiscussionAccess = SocietyContentAccess;
export const discussionAccess = societyContentAccess;

export const UUID_RE = /^[0-9a-f-]{36}$/i;
