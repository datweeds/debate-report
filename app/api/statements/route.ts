import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createStatement } from '@/lib/statements';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await req.json();
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
