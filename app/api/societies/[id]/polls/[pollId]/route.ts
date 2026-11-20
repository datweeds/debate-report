import { NextRequest, NextResponse } from 'next/server';
import { sealedFor } from '@/lib/sealed/server';
import { notifyNew } from '@/lib/notify';
import pool from '@/lib/db';
import { hasVoted, myBallot, openQuestions, results, resultsVisible, sealPayload, voterSplit, questionCount, pollItem } from '@/lib/polls/server';
import { memberCount, pollContext, readSettings, voterPayload } from '@/lib/polls/access';
import { validatePayload } from '@/lib/polls/tally';
import type { PollPayload } from '@/lib/polls/types';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string; pollId: string }> };

// GET — the poll for this viewer: questions, settings, my vote, results (if visible).
export async function GET(req: NextRequest, { params }: Params) {
  const { id, pollId } = await params;
  const c = await pollContext(req, id, pollId);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { poll, manager } = c;
  const voted = c.voterKey ? await hasVoted(poll.id, c.voterKey) : false;
  const { payload: _p, ...settings } = poll;
  return NextResponse.json({
    poll: { ...settings, payload: voterPayload(poll, manager), open_questions: openQuestions(poll), question_count: questionCount(poll) },
    voted,
    myBallot: voted && c.voterKey ? await myBallot(poll, c.voterKey) : null,
    canVote: c.canVote && (!voted || poll.allow_revote),
    isMember: c.a.isMember, manager,
    members: manager ? await memberCount(c.a.societyId) : null,
    voters: manager ? (await voterSplit([poll.id])).get(poll.id) ?? { members: 0, codes: 0 } : null,
    results: resultsVisible(poll, manager) ? await results(poll, manager) : null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

// PATCH — moderators: { action: 'open' | 'close' | 'reveal' | 'reopen' } or edits
// ({ payload } while a draft; settings at any time).
async function handlePATCH(req: NextRequest, { params }: Params) {
  const { id, pollId } = await params;
  const c = await pollContext(req, id, pollId);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!c.manager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { poll } = c;
  const b = await req.json().catch(() => ({}));

  if (b.action) {
    if (b.action === 'open') {
      if (poll.status !== 'draft') return NextResponse.json({ error: 'Only a draft can be opened' }, { status: 409 });
      // A sealed poll's questions were checked in the browser that wrote them
      const v = poll.sealed_payload ? { ok: true as const } : validatePayload(poll.payload);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      if (poll.close_mode === 'fixed' && (!poll.closes_at || new Date(poll.closes_at) <= new Date())) {
        return NextResponse.json({ error: 'Set a closing time in the future, or close it by hand' }, { status: 400 });
      }
      if (!poll.members_may_vote && !poll.allow_codes) return NextResponse.json({ error: 'Let members vote, or allow access codes' }, { status: 400 });
      if (poll.question_order === 'sequential' && !poll.allow_revote) return NextResponse.json({ error: 'Questions revealed one at a time need voters to be able to update their ballot' }, { status: 400 });
      await pool.query(`UPDATE society_polls SET status = 'open', opened_at = now(), questions_revealed = $2, updated_at = now() WHERE id = $1`,
        [poll.id, poll.question_order === 'sequential' ? 1 : questionCount(poll)]);
      if (poll.members_may_vote) notifyNew({
        societyId: c.a.societyId, kind: 'polls', authorId: c.a.session?.sub ?? null, title: poll.payload.title,
        heading: 'A poll has opened in {society}', url: `/society/${c.a.societyId}/polls/${poll.id}`,
      });
    } else if (b.action === 'close') {
      if (poll.status !== 'open') return NextResponse.json({ error: 'It is not open' }, { status: 409 });
      await pool.query(`UPDATE society_polls SET status = 'closed', closed_at = now(), updated_at = now() WHERE id = $1`, [poll.id]);
    } else if (b.action === 'reopen') {
      if (poll.status !== 'closed') return NextResponse.json({ error: 'It is not closed' }, { status: 409 });
      await pool.query(`UPDATE society_polls SET status = 'open', closed_at = NULL, close_mode = 'manual', updated_at = now() WHERE id = $1`, [poll.id]);
    } else if (b.action === 'reveal') {
      if (poll.status !== 'open' || poll.question_order !== 'sequential') return NextResponse.json({ error: 'Not a live, one-at-a-time poll' }, { status: 409 });
      if (poll.questions_revealed >= questionCount(poll)) return NextResponse.json({ error: 'Every question is already open' }, { status: 409 });
      await pool.query(`UPDATE society_polls SET questions_revealed = questions_revealed + 1, updated_at = now() WHERE id = $1`, [poll.id]);
    } else return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const s = readSettings(b);
  if ('error' in s) return NextResponse.json({ error: s.error }, { status: 400 });
  const set: Record<string, unknown> = { ...s.settings };
  if (poll.status !== 'draft') {
    // Once voting starts, only timing and who sees results can change: the rest would change what voters agreed to
    for (const k of Object.keys(set)) if (!['closes_at', 'close_mode', 'result_visibility'].includes(k)) delete set[k];
    if (b.payload) return NextResponse.json({ error: 'Questions can only be edited while the poll is a draft' }, { status: 409 });
  }
  const item = pollItem(poll);
  if (item) { set.is_quiz = false; set.allow_codes = false; delete set.members_may_vote; }   // sealed: see creating one
  if (b.payload && item) {
    const count = Number(b.questionCount);
    if (!sealedFor(item, b.payload, 4_000_000) || !Number.isInteger(count) || count < 1 || count > 50) {
      return NextResponse.json({ error: 'This sealed poll’s keys have changed: reload the page and try again' }, { status: 400 });
    }
    set.payload = b.payload; set.question_count = count;
  } else if (b.payload) {
    const p = b.payload as PollPayload;
    if (typeof b.payload === 'string') return NextResponse.json({ error: 'This poll isn’t sealed' }, { status: 400 });
    if (!p?.title?.trim()) return NextResponse.json({ error: 'Give the poll a title' }, { status: 400 });
    if (JSON.stringify(p).length > 3_000_000) return NextResponse.json({ error: 'The poll is too large (images?)' }, { status: 400 });
    set.payload = await sealPayload(c.a.societyId, p);
  }
  const cols = Object.keys(set);
  if (cols.length) {
    await pool.query(`UPDATE society_polls SET ${cols.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() WHERE id = $1`,
      [poll.id, ...Object.values(set)]);
  }
  return NextResponse.json({ ok: true });
}

// DELETE — moderators (or SysAdmin as takedown).
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id, pollId } = await params;
  const c = await pollContext(req, id, pollId);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!c.a.canTakeDown) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await pool.query('UPDATE society_polls SET deleted_at = now() WHERE id = $1', [c.poll.id]);
  return NextResponse.json({ ok: true });
}

export const PATCH = lockSafe(handlePATCH);
