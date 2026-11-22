import type { SessionPayload } from './auth';
import { isSocietyModerator } from './roles';
import type { Owner } from './billing';

/**
 * Whose billing a request is about: the signed-in person, or a Society they
 * moderate (only a Society's moderators manage its billing).
 */
export async function billingOwner(session: SessionPayload, societyId: unknown): Promise<Owner | null> {
  if (societyId == null || societyId === '') return { kind: 'user', id: session.sub };
  const id = Number(societyId);
  if (!Number.isInteger(id) || id <= 0) return null;
  return (await isSocietyModerator(session, id)) ? { kind: 'society', id } : null;
}
