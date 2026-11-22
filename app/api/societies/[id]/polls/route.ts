import { NextRequest, NextResponse } from 'next/server';
import { formalProblem } from '@/lib/polls/formal';
import { allowsSealed, firstLocks, readLocks, sealedFor, UUID_RE_SEALED } from '@/lib/sealed/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { listPolls, memberVoter, sealPayload, voterSplit, questionCount } from '@/lib/polls/server';
import { memberCount, readSettings } from '@/lib/polls/access';
import type { PollPayload } from '@/lib/polls/types';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string }> };

// GET — the Society's polls (drafts for its moderators), with turnout and whether I've voted.
export async function GET(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const polls = await listPolls(a.societyId, a.canModerate);
  const mine = a.session && a.isMember
    ? new Set((await pool.query('SELECT poll_id FROM poll_participants WHERE voter_key = $1', [memberVoter(a.session.sub)])).rows.map(r => r.poll_id))
    : new Set();
  const split = await voterSplit(polls.map(p => p.id));
  return NextResponse.json({
    polls: polls.map(p => ({
      id: p.id, title: p.sealed_payload ?? p.payload.title, description: p.sealed_payload ? null : p.payload.description ?? null,
      questions: questionCount(p), protection: p.protection,
      status: p.status, closes_at: p.closes_at, opened_at: p.opened_at, closed_at: p.closed_at, created_at: p.created_at,
      vote_count: p.vote_count, ballot_mode: p.ballot_mode, is_quiz: p.is_quiz, result_visibility: p.result_visibility,
      members_may_vote: p.members_may_vote, member_votes: split.get(p.id)?.members ?? 0, code_votes: split.get(p.id)?.codes ?? 0,
      voted: mine.has(p.id),
    })),
    members: await memberCount(a.societyId),
    canCreate: a.canModerate, isMember: a.isMember, allowSealed: a.isMember && await allowsSealed(a.societyId),
  });
}

// POST { payload, ...settings } — moderators create a poll (as a draft).
async function handlePOST(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Only Society Admins can create polls' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  // Sealed: { protection: 'sealed', id, payload (the questions, sealed in the browser), questionCount, locks, ...settings }
  if (b.protection === 'sealed') {
    if (!a.isMember || !await allowsSealed(a.societyId)) return NextResponse.json({ error: 'This Society doesn’t allow Sealed polls' }, { status: 403 });
    const locks = readLocks(b.locks);
    const item = { type: 'poll' as const, id: String(b.id), societyId: a.societyId, epoch: 1 };
    const count = Number(b.questionCount);
    if (!UUID_RE_SEALED.test(item.id) || !locks || !sealedFor(item, b.payload, 4_000_000) || !Number.isInteger(count) || count < 1 || count > 50) {
      return NextResponse.json({ error: 'That sealed poll wasn’t understood' }, { status: 400 });
    }
    const s = readSettings(b);
    if ('error' in s) return NextResponse.json({ error: s.error }, { status: 400 });
    // Every member holds the key, so a quiz's answers couldn't be hidden; and code voters have no key
    const settings = { ...s.settings, is_quiz: false, allow_codes: false, members_may_vote: true, formal: false };
    const cols = Object.keys(settings);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO society_polls (id, customer_id, payload, created_by, protection, sealed_epoch, question_count${cols.map(c => `, ${c}`).join('')})
         VALUES ($1, $2, $3, $4, 'sealed', 1, $5${cols.map((_, i) => `, $${i + 6}`).join('')})`,
        [item.id, a.societyId, b.payload, a.session!.sub, count, ...Object.values(settings)]);
      const problem = await firstLocks(client, item, a.session!.sub, locks);
      if (problem) { await client.query('ROLLBACK'); return NextResponse.json({ error: problem }, { status: 400 }); }
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
    return NextResponse.json({ id: item.id }, { status: 201 });
  }
  const payload = b.payload as PollPayload;
  if (!payload?.title?.trim()) return NextResponse.json({ error: 'Give the poll a title' }, { status: 400 });
  if (JSON.stringify(payload).length > 3_000_000) return NextResponse.json({ error: 'The poll is too large (images?)' }, { status: 400 });
  const s = readSettings(b);
  if ('error' in s) return NextResponse.json({ error: s.error }, { status: 400 });
  const problem = await formalProblem(a.societyId, { formal: s.settings.formal === true, is_quiz: s.settings.is_quiz === true, sealed: false });
  if (problem) return problem;
  const cols = Object.keys(s.settings);
  const { rows: [p] } = await pool.query(
    `INSERT INTO society_polls (customer_id, payload, created_by${cols.map(c => `, ${c}`).join('')})
     VALUES ($1, $2, $3${cols.map((_, i) => `, $${i + 4}`).join('')}) RETURNING id`,
    [a.societyId, await sealPayload(a.societyId, payload), a.session!.sub, ...Object.values(s.settings)]);
  return NextResponse.json({ id: p.id }, { status: 201 });
}

export const POST = lockSafe(handlePOST);
