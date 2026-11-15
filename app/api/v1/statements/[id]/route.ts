import { NextRequest, NextResponse } from 'next/server';
import { getPartyFromRequest, lookupExternalAuthor, partyDebateAccess, PRIVATE_DEBATE_ERROR } from '@/lib/apiParties';
import { getStatementForOwnershipCheck, updateStatementText, retractStatementCascade } from '@/lib/statements';
import { statementWarnings } from '@/lib/quality/report';

type Params = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f-]{36}$/i;

// Both PATCH and DELETE need to know which of this party's users is acting —
// ownership is "that external user's mapped local user must be the statement's
// creator." Accepted as a query param (?external_user_id=...) or a body field,
// since some HTTP clients/proxies don't forward a body on DELETE. No auto-create
// here: the author must already exist (they had to, to have created the statement).
async function identifyActingAuthor(partyId: string, externalUserId: unknown): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }> {
  if (!externalUserId || typeof externalUserId !== 'string') {
    return { ok: false, status: 400, error: 'external_user_id is required (query param or body field)' };
  }
  const userId = await lookupExternalAuthor(partyId, externalUserId);
  if (!userId) return { ok: false, status: 404, error: 'Unknown external_user_id for this token' };
  return { ok: true, userId };
}

// PATCH /api/v1/statements/:id — body: { external_user_id, title, description? }
export async function PATCH(req: NextRequest, { params }: Params) {
  const party = await getPartyFromRequest(req);
  if (!party) return NextResponse.json({ error: 'Invalid or missing API token' }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const externalUserId = req.nextUrl.searchParams.get('external_user_id') ?? body.external_user_id;
  const author = await identifyActingAuthor(party.id, externalUserId);
  if (!author.ok) return NextResponse.json({ error: author.error }, { status: author.status });

  const stmt = UUID.test(id) ? await getStatementForOwnershipCheck(id) : null;
  if (!stmt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (stmt.created_by !== author.userId) {
    return NextResponse.json({ error: 'You can only edit statements your own external user created' }, { status: 403 });
  }
  if (await partyDebateAccess(party.id, stmt.resolution_id ?? id) === 'forbidden') {
    return NextResponse.json({ error: PRIVATE_DEBATE_ERROR }, { status: 403 });
  }

  const result = await updateStatementText(id, body.title ?? '', body.description ?? null, stmt.resolution_id ?? id, author.userId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  const warnings = await statementWarnings(stmt.resolution_id, id).catch(() => []);
  return NextResponse.json({ ...result.data, warnings });
}

// DELETE /api/v1/statements/:id?external_user_id=... (or JSON body) — soft-deletes
// ("retracts") this statement and everything that depends on it, mirroring the
// internal app's Retract action.
export async function DELETE(req: NextRequest, { params }: Params) {
  const party = await getPartyFromRequest(req);
  if (!party) return NextResponse.json({ error: 'Invalid or missing API token' }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const externalUserId = req.nextUrl.searchParams.get('external_user_id') ?? body.external_user_id;
  const author = await identifyActingAuthor(party.id, externalUserId);
  if (!author.ok) return NextResponse.json({ error: author.error }, { status: author.status });

  const stmt = UUID.test(id) ? await getStatementForOwnershipCheck(id) : null;
  if (!stmt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (stmt.created_by !== author.userId) {
    return NextResponse.json({ error: 'You can only retract statements your own external user created' }, { status: 403 });
  }
  if (await partyDebateAccess(party.id, stmt.resolution_id ?? id) === 'forbidden') {
    return NextResponse.json({ error: PRIVATE_DEBATE_ERROR }, { status: 403 });
  }

  const retracted = await retractStatementCascade(id);
  return NextResponse.json({ retracted });
}
