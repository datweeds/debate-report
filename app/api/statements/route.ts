import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createStatement } from '@/lib/statements';
import { statementAccess } from '@/lib/debateAccess';
import { lockSafe } from '@/lib/lockSafe';

async function handlePOST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await req.json();
  if (typeof body.resolutionId !== 'string' || !(await statementAccess(session, body.resolutionId))?.viewable) {
    return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
  }
  const result = await createStatement({
    resolutionId: body.resolutionId,
    parentId: body.parentId,
    statType: body.statType,
    statTitle: body.statTitle,
    statDirection: body.statDirection ?? null,
    statDescription: body.statDescription ?? null,
    createdBy: session.sub,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { status: 201 });
}

export const POST = lockSafe(handlePOST);
