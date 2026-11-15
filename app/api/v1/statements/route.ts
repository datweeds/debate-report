import { NextRequest, NextResponse } from 'next/server';
import { getPartyFromRequest, resolveOrCreateExternalAuthor, partyDebateAccess, PRIVATE_DEBATE_ERROR } from '@/lib/apiParties';
import { createStatement } from '@/lib/statements';
import { statementWarnings } from '@/lib/quality/report';

// POST /api/v1/statements — create a statement (claim, warrant, evidence, etc.)
// on behalf of one of this party's external users. Body:
//   external_user_id   (required) — the party's own opaque ID for the author
//   author_name        (optional) — display name, set the first time this
//                                    external_user_id is seen; ignored after
//   parent_id          (required) — statement this attaches to
//   resolution_id      (required)
//   stat_type          (required) — framework | claim | warrant | evidence | impact | rebuttal | turn
//   stat_title         (required)
//   stat_direction     (optional) — 'for' | 'against'
//   stat_description   (optional)
// "Attaching evidence" is just creating a statement of stat_type 'evidence'
// with parent_id set to the claim/warrant it supports — no separate mechanism.
export async function POST(req: NextRequest) {
  const party = await getPartyFromRequest(req);
  if (!party) return NextResponse.json({ error: 'Invalid or missing API token' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  // Checked before the author is created, so a refused call doesn't use up a user slot
  if (await partyDebateAccess(party.id, body.resolution_id) === 'forbidden') {
    return NextResponse.json({ error: PRIVATE_DEBATE_ERROR }, { status: 403 });
  }

  const author = await resolveOrCreateExternalAuthor(party, body.external_user_id, body.author_name);
  if (!author.ok) return NextResponse.json({ error: author.error }, { status: author.status });

  const result = await createStatement({
    resolutionId: body.resolution_id,
    parentId: body.parent_id,
    statType: body.stat_type,
    statTitle: body.stat_title,
    statDirection: body.stat_direction ?? null,
    statDescription: body.stat_description ?? null,
    createdBy: author.userId,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  // Advisory quality checks (same rules as the Debate Quality Report); never block the write
  const warnings = await statementWarnings(body.resolution_id, (result.data as { statement: { id: string } }).statement.id).catch(() => []);
  return NextResponse.json({ ...result.data, warnings }, { status: 201 });
}
