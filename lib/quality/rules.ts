// Debate quality rules: deterministic checks of structure and house style for a
// Public Forum debate. Pure functions with no I/O, so the same rules run in the
// browser (live warnings while a statement is written) and on the server (the
// structural half of the Debate Quality Report).
//
// Two scopes:
//   'statement' — judged from one statement's own text plus the debate around it.
//                 Shown as warnings while creating or editing.
//   'structure' — need the finished tree (missing children, balance, clash).
//                 Report only: a claim with no evidence yet is normal mid-writing.

import { PF_ALLOWED_CHILDREN } from '../../components/chamber/constants';

export type Severity = 'critical' | 'major' | 'minor' | 'suggestion';

export type Category =
  | 'structure' | 'support' | 'clarity' | 'references' | 'duplication' | 'balance'
  // categories used by the AI review
  | 'logic' | 'fallacy' | 'relevance' | 'evidence';

export type Finding = {
  ruleId: string;
  severity: Severity;
  category: Category;
  statementId: string | null;   // null = the debate as a whole
  ref: string | null;           // e.g. 'CF2'
  observation: string;          // what is wrong
  recommendation: string;       // what the moderator should do
  fingerprint: string;          // stable across runs, for New / Still open / Resolved
  fallacy?: string;             // AI findings: fallacy name from the fallacies table
};

export type QStatement = {
  id: string;
  stat_type: string;
  stat_direction: string | null;
  stat_title: string;
  stat_description: string | null;
  stat_ref?: string | null;
  retracted_at?: string | null;
};

export type QDebate = {
  resolution: { id: string; stat_title: string; stat_description: string | null };
  statements: QStatement[];
  // stat_id_supported = parent, stat_id_supported_by = child
  relationships: { stat_id_supported: string; stat_id_supported_by: string }[];
};

// A statement being written, before (or instead of) the saved version.
export type Draft = {
  id?: string;                 // set when editing an existing statement
  stat_ref?: string | null;
  stat_type: string;
  stat_direction: string | null;
  stat_title: string;
  stat_description: string | null;
};

export const SEVERITY_ORDER: Severity[] = ['critical', 'major', 'minor', 'suggestion'];
export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical', major: 'Major', minor: 'Minor', suggestion: 'Suggestion',
};

const TYPE_NAME: Record<string, string> = {
  framework: 'framework', claim: 'claim', warrant: 'warrant', evidence: 'evidence',
  impact: 'impact', rebuttal: 'rebuttal', turn: 'turn', resolution: 'resolution',
};

// ── Text helpers ─────────────────────────────────────────────────────────────

export const REF_PATTERN = /\b((?:CF|CA|FW|RB|[CWEIT])\d+)\b/g;

export function citedRefs(text: string | null | undefined): string[] {
  return text ? [...new Set([...text.matchAll(REF_PATTERN)].map(m => m[1]))] : [];
}

const STOP = new Set(('a an and are as at be by for from has have if in into is it its of on or ' +
  'that the their this to was were will with would not no than then so such can could should').split(' '));

function words(s: string): Set<string> {
  return new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)));
}

function similarity(a: string, b: string): number {
  const A = words(a), B = words(b);
  if (A.size < 3 || B.size < 3) return 0;
  let both = 0;
  A.forEach(w => { if (B.has(w)) both++; });
  return both / (A.size + B.size - both);
}

// The house style: say *why* the statement supports or rebuts its parent.
const EXPLAINS_LINK = /\bwhy this\b|\bthis (supports|rebuts|undermines|challenges|matters|connects|shows|means)\b|\b(therefore|so the|which means|it follows)\b/i;
// A source of some kind: link, attribution dash, "Source:", a year, a page, or a video timestamp.
const HAS_SOURCE = /https?:\/\/|www\.|\bsource:|\bcited\b|(^|\n)\s*[—–-]{1,2}\s*\S|\(\s*(19|20)\d\d\s*\)|\b(19|20)\d\d\b|\bp\.\s*\d|\b\d{1,2}:\d{2}(:\d{2})?\b/i;

const ref = (s: QStatement | Draft) => ('stat_ref' in s ? s.stat_ref ?? null : null);
const label = (s: QStatement | Draft) => ref(s) ?? `this ${TYPE_NAME[s.stat_type] ?? 'statement'}`;

function finding(
  ruleId: string, severity: Severity, category: Category,
  s: QStatement | Draft | null, observation: string, recommendation: string, extraKey = '',
): Finding {
  const id = s && 'id' in s && s.id ? s.id : null;
  return {
    ruleId, severity, category,
    statementId: id, ref: s ? ref(s) : null,
    observation, recommendation,
    fingerprint: [ruleId, id ?? 'debate', extraKey].filter(Boolean).join(':'),
  };
}

// ── Statement-scope rules ────────────────────────────────────────────────────

function statementRules(s: QStatement | Draft, debate: QDebate): Finding[] {
  const out: Finding[] = [];
  const t = s.stat_type;
  const title = s.stat_title.trim();
  const desc = (s.stat_description ?? '').trim();
  const who = label(s);
  const live = debate.statements.filter(x => !x.retracted_at && x.id !== ('id' in s ? s.id : undefined));

  if (desc.length < 40) {
    out.push(t === 'evidence'
      ? finding('evidence-no-detail', 'major', 'support', s,
          `${who} has no quote, data or source in its description.`,
          'Add the actual quote or figure, who said or published it, and where (link, publication or timestamp).')
      : finding('no-description', 'major', 'clarity', s,
          `${who} has little or no description, so readers can't see the reasoning behind the title.`,
          `Explain the ${TYPE_NAME[t] ?? 'statement'} in the description, including why it matters to the statement it responds to.`));
  } else if (['claim', 'rebuttal', 'turn', 'warrant'].includes(t) && !EXPLAINS_LINK.test(desc)) {
    out.push(finding('no-link-explanation', 'minor', 'clarity', s,
      `${who} doesn't explain why it ${t === 'rebuttal' || t === 'turn' ? 'rebuts' : 'supports'} the statement it is attached to.`,
      `Add a "Why this ${t === 'rebuttal' || t === 'turn' ? 'rebuts' : 'supports'} …" paragraph spelling out the link.`));
  }

  if (t === 'evidence' && desc.length >= 40 && !HAS_SOURCE.test(desc)) {
    out.push(finding('evidence-no-source', 'minor', 'support', s,
      `${who} gives no identifiable source (author, publication, link, date or timestamp).`,
      'Attribute the evidence so readers can check it.'));
  }

  if (title.endsWith('?') && t !== 'resolution') {
    out.push(finding('title-question', 'minor', 'clarity', s,
      `${who}'s title is a question rather than a position.`,
      'Rewrite the title as a statement that can be agreed or disagreed with.'));
  }
  const wordCount = title.split(/\s+/).filter(Boolean).length;
  if (wordCount > 0 && wordCount < 4) {
    out.push(finding('title-too-short', 'suggestion', 'clarity', s,
      `${who}'s title is very short ("${title}").`,
      'Make the title a complete, specific statement of the point.'));
  } else if (title.length > 220) {
    out.push(finding('title-too-long', 'suggestion', 'clarity', s,
      `${who}'s title is ${title.length} characters long.`,
      'Keep the title to one clear sentence and move the detail into the description.'));
  }

  // References to other statements must exist and be live
  const byRef = new Map(debate.statements.filter(x => x.stat_ref).map(x => [x.stat_ref as string, x]));
  for (const r of citedRefs(`${title}\n${desc}`)) {
    if (r === ref(s)) continue;
    const target = byRef.get(r);
    if (!target) {
      out.push(finding('ref-missing', 'major', 'references', s,
        `${who} refers to ${r}, but there is no ${r} in this debate.`,
        `Correct or remove the reference to ${r}.`, r));
    } else if (target.retracted_at) {
      out.push(finding('ref-retracted', 'minor', 'references', s,
        `${who} refers to ${r}, which has been retracted.`,
        `Remove the reference to ${r} or point to the statement that replaced it.`, r));
    }
  }

  // Near-duplicate titles
  for (const other of live) {
    if (other.stat_type === 'resolution') continue;
    if (similarity(title, other.stat_title) >= 0.75) {
      const otherName = other.stat_ref ?? `"${other.stat_title.slice(0, 60)}"`;
      const key = 'id' in s && s.id ? [s.id, other.id].sort().join('|') : other.id;
      out.push(finding('duplicate-title', 'minor', 'duplication', s,
        `${who} looks very similar to ${otherName}.`,
        `Merge the two, or make clear how ${who} differs from ${otherName}.`, key));
    }
  }

  return out;
}

// Live warnings for a statement being created or edited.
export function checkDraft(draft: Draft, debate: QDebate): Finding[] {
  return statementRules(draft, debate);
}

// ── Structure-scope rules + full run ─────────────────────────────────────────

export function runRules(debate: QDebate): Finding[] {
  const out: Finding[] = [];
  const res = debate.resolution;
  const live = debate.statements.filter(s => !s.retracted_at && s.stat_type !== 'resolution');
  const byId = new Map(debate.statements.map(s => [s.id, s]));
  const children = new Map<string, QStatement[]>();
  const parents = new Map<string, string[]>();
  for (const r of debate.relationships) {
    const child = byId.get(r.stat_id_supported_by);
    if (!child) continue;
    if (!children.has(r.stat_id_supported)) children.set(r.stat_id_supported, []);
    children.get(r.stat_id_supported)!.push(child);
    if (!parents.has(child.id)) parents.set(child.id, []);
    parents.get(child.id)!.push(r.stat_id_supported);
  }
  const liveKids = (id: string) => (children.get(id) ?? []).filter(c => !c.retracted_at);
  const typeOf = (id: string) => (id === res.id ? 'resolution' : byId.get(id)?.stat_type);

  // Debate level
  const claimsFor = live.filter(s => s.stat_type === 'claim' && s.stat_direction === 'for').length;
  const claimsAgainst = live.filter(s => s.stat_type === 'claim' && s.stat_direction === 'against').length;
  if (claimsFor + claimsAgainst === 0) {
    out.push(finding('no-claims', 'critical', 'balance', null,
      'The debate has no claims yet.',
      'Add at least one claim for and one against the resolution.'));
  } else if (claimsFor === 0 || claimsAgainst === 0) {
    const missing = claimsFor === 0 ? 'For' : 'Against';
    out.push(finding('one-sided', 'major', 'balance', null,
      `There are no ${missing} claims, so the debate only argues one side.`,
      `Add the strongest ${missing} claims, so both sides of the resolution are tested.`));
  } else {
    const ratio = Math.min(claimsFor, claimsAgainst) / Math.max(claimsFor, claimsAgainst);
    if (ratio < 0.5) {
      out.push(finding('imbalanced', 'minor', 'balance', null,
        `The sides are unbalanced: ${claimsFor} For claims vs ${claimsAgainst} Against.`,
        `Strengthen the ${claimsFor < claimsAgainst ? 'For' : 'Against'} side or consolidate the other.`));
    }
  }
  if (!live.some(s => s.stat_type === 'framework')) {
    out.push(finding('no-framework', 'minor', 'structure', null,
      'There is no framework telling readers how to weigh the arguments.',
      'Add a framework (e.g. "weigh by scale of harm to people" or "judge evidence by expertise") that both sides can be measured against.'));
  }
  if ((res.stat_description ?? '').trim().length < 40) {
    out.push(finding('resolution-no-description', 'minor', 'clarity', null,
      'The resolution has no description defining its terms or scope.',
      'Describe what the resolution means, define key terms, and say what each side must show.'));
  }
  if (res.stat_title.trim().endsWith('?')) {
    out.push(finding('resolution-question', 'minor', 'clarity', null,
      'The resolution is phrased as a question.',
      'Phrase the resolution as a statement the For side affirms and the Against side negates.'));
  }

  for (const s of live) {
    out.push(...statementRules(s, debate));
    const kids = liveKids(s.id);
    const kidTypes = new Set(kids.map(k => k.stat_type));
    const who = label(s);
    const myParents = parents.get(s.id) ?? [];

    if (myParents.length === 0) {
      out.push(finding('orphan', 'major', 'structure', s,
        `${who} isn't connected to anything in the debate.`,
        'Attach it to the statement it supports or rebuts, or retract it.'));
    }
    for (const pid of myParents) {
      const pType = typeOf(pid);
      if (pType && !(PF_ALLOWED_CHILDREN[pType] ?? []).includes(s.stat_type)) {
        out.push(finding('wrong-parent', 'major', 'structure', s,
          `${who} (${TYPE_NAME[s.stat_type]}) is attached to a ${TYPE_NAME[pType] ?? pType}, which Public Forum structure doesn't allow.`,
          `Move it under a statement that can take a ${TYPE_NAME[s.stat_type]}: ${Object.entries(PF_ALLOWED_CHILDREN).filter(([, c]) => c.includes(s.stat_type)).map(([p]) => TYPE_NAME[p] ?? p).join(', ')}.`, pid));
      }
      const parent = byId.get(pid);
      if (parent?.retracted_at) {
        out.push(finding('parent-retracted', 'minor', 'structure', s,
          `${who} responds to a statement that has been retracted.`,
          'Re-attach it to a live statement or retract it too.', pid));
      }
    }

    if (s.stat_type === 'claim') {
      const supported = kidTypes.has('evidence')
        || kids.some(k => k.stat_type === 'warrant' && liveKids(k.id).some(e => e.stat_type === 'evidence'));
      if (!supported) {
        out.push(finding('claim-unsupported', 'major', 'support', s,
          `${who} has no evidence behind it (directly or through a warrant).`,
          'Add evidence, or a warrant with evidence, that backs the claim.'));
      }
      if (!kidTypes.has('impact')) {
        out.push(finding('claim-no-impact', 'minor', 'structure', s,
          `${who} has no impact, so it doesn't say why the claim matters.`,
          'Add an impact describing the consequence if the claim is true (who is affected, how much, how likely).'));
      }
      if (!kidTypes.has('rebuttal') && !kidTypes.has('turn')) {
        out.push(finding('claim-unchallenged', 'suggestion', 'balance', s,
          `${who} has not been challenged by any rebuttal.`,
          'Add the strongest rebuttal from the other side, so the claim is tested (Public Forum expects direct clash).'));
      }
    }
    if (s.stat_type === 'warrant' && !kidTypes.has('evidence')) {
      out.push(finding('warrant-no-evidence', 'minor', 'support', s,
        `${who} has no evidence attached.`,
        'Attach evidence showing the reasoning holds in practice.'));
    }
    if ((s.stat_type === 'rebuttal' || s.stat_type === 'turn') && !kidTypes.has('evidence') && !kidTypes.has('warrant')) {
      out.push(finding('rebuttal-unsupported', 'major', 'support', s,
        `${who} is an assertion with no evidence or warrant behind it.`,
        'Back the rebuttal with evidence, or a warrant explaining why it defeats the original point.'));
    }

    // House style: name your supporting statements by reference
    const kidRefs = kids.map(k => k.stat_ref).filter(Boolean) as string[];
    if (kidRefs.length && ['claim', 'warrant', 'rebuttal', 'turn', 'framework'].includes(s.stat_type)) {
      const cited = new Set(citedRefs(s.stat_description));
      const uncited = kidRefs.filter(r => !cited.has(r));
      if (uncited.length === kidRefs.length) {
        out.push(finding('children-not-cited', 'suggestion', 'references', s,
          `${who}'s description doesn't cite any of the statements under it (${kidRefs.join(', ')}).`,
          `List them in the description, e.g. "Evidence: ${kidRefs.slice(0, 3).join(', ')}", so readers can follow the argument.`));
      }
    }
  }

  // Each pair of near-duplicates is reported once, from both sides; keep one.
  const seen = new Set<string>();
  return out.filter(f => {
    if (f.ruleId !== 'duplicate-title') return true;
    const key = f.fingerprint.replace(/^duplicate-title:[^:]+:/, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
}

// 100 = no findings. The penalty is taken per statement, so a large debate
// isn't punished just for having more to check, and falls off on a curve so
// a weak debate still shows progress as it improves (it never hits a floor).
const PENALTY: Record<Severity, number> = { critical: 15, major: 5, minor: 2, suggestion: 0.5 };
export function qualityScore(findings: Pick<Finding, 'severity'>[], statementCount: number): number {
  const penalty = findings.reduce((n, f) => n + PENALTY[f.severity], 0);
  return Math.round(100 * Math.exp(-penalty / Math.max(10, statementCount) / 8));
}
