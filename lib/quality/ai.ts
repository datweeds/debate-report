// AI half of the Debate Quality Report: judges reasoning quality (logic,
// evidence fit, relevance, fallacies, redundancy) that deterministic rules
// can't. Server-only.

import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';
import pool from '@/lib/db';
import type { Category, Finding, QDebate, Severity } from './rules';

// First model that the API key accepts is used.
const MODELS = ['claude-sonnet-5-5', 'claude-sonnet-5'];

const AI_CATEGORIES = ['logic', 'fallacy', 'relevance', 'evidence', 'duplication', 'clarity', 'balance'] as const;

export type AiResult = { model: string; summary: string; findings: Finding[] };

// An open finding from the previous run, so the reviewer can say which issues persist.
export type PreviousFinding = { key: string; ref: string | null; observation: string };

const RUBRIC = `You are reviewing a debate on new.vote for its moderator. The debate follows Public Forum format, recorded as a tree of statements:
- Resolution: the proposition being debated. "For" statements affirm it, "Against" statements negate it.
- Framework (FW): how the arguments should be weighed.
- Claim (CF = For, CA = Against): a contention for or against the resolution.
- Warrant (W): the reasoning that connects evidence to a claim (Toulmin's warrant).
- Evidence (E): quotes, data or sources backing its parent.
- Impact (I): why the claim matters: magnitude, probability, timeframe, who is affected.
- Rebuttal (RB) / Turn (T): a direct response that challenges its parent.
Every statement has a reference (CF2, RB1, E14…). Statements cite each other by these references.

House style, taken from the debate this site treats as its benchmark:
- Each claim, warrant and rebuttal explains in its description WHY it supports or rebuts its parent ("Why this supports the resolution: …").
- Statements cite their supporting statements by reference ("Evidence: E6. Challenged by RB2. Impact: I2.").
- Evidence carries the actual quote or data with attribution (speaker, credentials, source, timestamp or link).
- Titles are single, specific, arguable sentences.

Judge the QUALITY OF REASONING, not which side is right:
- Apply exactly the same standard to both sides. Never treat a side as weaker because you find its conclusion less convincing, and never introduce your own evidence on the topic. Judge each argument on what the debate itself provides.
- Logic: does the conclusion follow? Does the warrant actually connect the evidence to the claim? Are there gaps, hidden assumptions or leaps?
- Evidence fit: does the evidence support the specific statement it sits under, or does the statement overreach what the evidence shows? Is a quote used out of context, or does it say something different from its title?
- Relevance and clash: does each rebuttal answer what its parent actually says (not a weaker version of it)? Are rebuttals answered?
- Fallacies: name a fallacy ONLY from the list provided, and only when the text clearly commits it. Quote or closely paraphrase the passage.
- Redundancy: different statements making substantially the same point, even in different words.
- Inconclusive or unclear arguments: vague claims, undefined terms, impacts with no sense of size or likelihood, contradictions within a side.

Do NOT report things already checked automatically (they appear in the report separately): missing descriptions, missing evidence/impact/rebuttal children, missing "why this supports" paragraphs, broken references, title length, near-identical titles, statements attached to the wrong type of parent, side balance, missing framework.

Severity:
- critical: invalidates a core argument or misrepresents evidence.
- major: a significant weakness a Public Forum judge would penalise.
- minor: weakens clarity or persuasiveness.
- suggestion: polish.

Every finding must be actionable: say exactly what the moderator should change, in which statement. Report at most 30 findings, most important first. Use statement references exactly as given; use null for a finding about the debate as a whole. Write in plain British English.`;

const TOOL: Anthropic.Tool = {
  name: 'report_findings',
  description: 'Return the debate quality findings.',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Two or three sentences: overall quality of reasoning and the most important things to fix.' },
      findings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            previous_key:   { type: ['string', 'null'], description: 'Key of the matching previous finding if this is the same issue still present, otherwise null' },
            ref:            { type: ['string', 'null'], description: 'Statement reference, e.g. "CF2", or null for the whole debate' },
            severity:       { type: 'string', enum: ['critical', 'major', 'minor', 'suggestion'] },
            category:       { type: 'string', enum: [...AI_CATEGORIES] },
            fallacy:        { type: ['string', 'null'], description: 'Exact fallacy name from the list, when category is fallacy' },
            observation:    { type: 'string', description: 'What is wrong, specifically' },
            recommendation: { type: 'string', description: 'What the moderator should change' },
          },
          required: ['ref', 'severity', 'category', 'observation', 'recommendation'],
        },
      },
    },
    required: ['summary', 'findings'],
  },
};

// The debate as indented text, in tree order, with references and parents.
function serialise(debate: QDebate): string {
  const byId = new Map(debate.statements.map(s => [s.id, s]));
  const kids = new Map<string, string[]>();
  for (const r of debate.relationships) {
    if (!kids.has(r.stat_id_supported)) kids.set(r.stat_id_supported, []);
    kids.get(r.stat_id_supported)!.push(r.stat_id_supported_by);
  }
  const lines: string[] = [
    `RESOLUTION: ${debate.resolution.stat_title}`,
    debate.resolution.stat_description ? `Description: ${debate.resolution.stat_description}` : '',
    '',
  ];
  const seen = new Set<string>();
  const walk = (parentId: string, parentLabel: string, depth: number) => {
    for (const id of kids.get(parentId) ?? []) {
      const s = byId.get(id);
      if (!s || s.retracted_at || seen.has(id)) continue;
      seen.add(id);
      const pad = '  '.repeat(depth);
      const side = s.stat_direction ? ` · ${s.stat_direction === 'for' ? 'For' : 'Against'}` : '';
      lines.push(`${pad}[${s.stat_ref ?? '?'}] ${s.stat_type}${side} · responds to ${parentLabel}`);
      lines.push(`${pad}Title: ${s.stat_title}`);
      if (s.stat_description) lines.push(`${pad}Description: ${s.stat_description.replace(/\n+/g, `\n${pad}  `)}`);
      lines.push('');
      walk(id, s.stat_ref ?? s.stat_type, depth + 1);
    }
  };
  walk(debate.resolution.id, 'the resolution', 0);
  return lines.join('\n');
}

export async function aiReview(debate: QDebate, dismissed: string[], previous: PreviousFinding[] = []): Promise<AiResult> {
  const { rows: fallacies } = await pool.query(
    'SELECT fallacy_name, fallacy_type, fallacy_description FROM fallacies ORDER BY fallacy_type DESC, fallacy_name',
  );
  const fallacyList = fallacies.map(f => `- ${f.fallacy_name} (${f.fallacy_type}): ${f.fallacy_description}`).join('\n');

  const prompt = [
    `<fallacies>\n${fallacyList}\n</fallacies>`,
    dismissed.length
      ? `<dismissed>\nThe moderator has already reviewed and dismissed these observations. Do not raise them again:\n${dismissed.map(d => `- ${d}`).join('\n')}\n</dismissed>`
      : '',
    previous.length
      ? `<previous_findings>\nOpen findings from the last review of this debate. For each one, check the current debate: if the issue is still present, report it again with previous_key set to its key (you may improve the wording); if it has been fixed, leave it out. Then add any further issues. Be consistent with the previous review: don't re-judge unchanged statements differently without reason.\n${previous.map(p => `- key=${p.key} · ${p.ref ?? 'whole debate'} · ${p.observation}`).join('\n')}\n</previous_findings>`
      : '',
    `<debate>\n${serialise(debate)}\n</debate>`,
    'Review the debate and call report_findings.',
  ].filter(Boolean).join('\n\n');

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let lastErr: unknown;
  for (const model of MODELS) {
    try {
      const msg = await client.messages.create({
        model,
        max_tokens: 16000,
        system: RUBRIC,
        tools: [TOOL],
        // Forcing a specific tool isn't supported by every model; the prompt asks for it
        tool_choice: { type: 'auto' },
        messages: [{ role: 'user', content: prompt }],
      });
      const block = msg.content.find(b => b.type === 'tool_use');
      let input: unknown = block?.type === 'tool_use' ? block.input : null;
      if (!input) {
        // Fallback: the same JSON written as text
        const text = msg.content.map(b => (b.type === 'text' ? b.text : '')).join('');
        const json = text.match(/\{[\s\S]*\}/);
        if (json) input = JSON.parse(json[0]);
      }
      if (!input) throw new Error('No findings returned');
      return { model, ...toFindings(input, debate, new Set(fallacies.map(f => f.fallacy_name)), new Set(previous.map(p => p.key))) };
    } catch (err) {
      lastErr = err;
      // Unknown model → try the next one; anything else is a real failure
      if ((err as { status?: number }).status !== 404) break;
    }
  }
  throw lastErr;
}

type RawFinding = {
  previous_key?: string | null; ref?: string | null; severity?: string; category?: string; fallacy?: string | null;
  observation?: string; recommendation?: string;
};

function toFindings(input: unknown, debate: QDebate, fallacyNames: Set<string>, previousKeys: Set<string>): { summary: string; findings: Finding[] } {
  const { summary = '', findings = [] } = (input ?? {}) as { summary?: string; findings?: RawFinding[] };
  const byRef = new Map(debate.statements.filter(s => s.stat_ref).map(s => [s.stat_ref as string, s]));
  const used = new Set<string>();
  const out: Finding[] = [];
  for (const f of findings) {
    if (!f.observation || !f.recommendation) continue;
    const severity = (['critical', 'major', 'minor', 'suggestion'].includes(f.severity ?? '') ? f.severity : 'minor') as Severity;
    const category = ((AI_CATEGORIES as readonly string[]).includes(f.category ?? '') ? f.category : 'logic') as Category;
    const stmt = f.ref ? byRef.get(f.ref.trim()) : undefined;
    const fallacy = f.fallacy && fallacyNames.has(f.fallacy) ? f.fallacy : null;
    // Same issue as last run → keep its key, so it shows as Still open (not New + Resolved)
    const prev = f.previous_key && previousKeys.has(f.previous_key) && !used.has(f.previous_key) ? f.previous_key : null;
    const fp = prev ?? `ai:${stmt?.stat_ref ?? 'debate'}:${crypto.randomBytes(4).toString('hex')}`;
    used.add(fp);
    out.push({
      ruleId: fallacy ? `ai-fallacy` : `ai-${category}`,
      severity, category,
      statementId: stmt?.id ?? null,
      ref: stmt?.stat_ref ?? null,
      observation: fallacy ? `${fallacy}: ${f.observation}` : f.observation,
      recommendation: f.recommendation,
      fingerprint: fp,
      ...(fallacy ? { fallacy } : {}),
    } as Finding);
  }
  return { summary, findings: out };
}
