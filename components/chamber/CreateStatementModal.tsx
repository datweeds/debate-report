'use client';

import { useState } from 'react';
import { PF_ALLOWED_CHILDREN, STAT_LABEL, STAT_BADGE, TYPE_DIRECTION_MODE } from './constants';
import type { ChamberRelationship } from './ChamberGraph';

type StatStub = { id: string; stat_type: string; stat_title: string };

type Props = {
  parentId: string;
  parentType: string;
  parentTitle: string;
  resolutionId: string;
  preSelectedType?: string;
  preSelectedDirection?: 'for' | 'against' | null;
  availableStatements?: StatStub[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCreated: (statement: any, relationship: ChamberRelationship) => void;
  onRelationshipLinked?: (relationship: ChamberRelationship) => void;
  onClose: () => void;
};

// ── Shared helpers ─────────────────────────────────────────────────────────────

function DirectionPicker({ value, onChange }: {
  value: 'for' | 'against' | '';
  onChange: (d: 'for' | 'against') => void;
}) {
  return (
    <div className="flex gap-2">
      {(['for', 'against'] as const).map(dir => (
        <button
          key={dir}
          type="button"
          onClick={() => onChange(dir)}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold border transition-all ${
            value === dir
              ? dir === 'for'
                ? 'bg-blue-600/80 text-blue-100 border-blue-500 ring-2 ring-blue-400/30'
                : 'bg-rose-600/80 text-rose-100 border-rose-500 ring-2 ring-rose-400/30'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
          }`}
        >
          {dir === 'for' ? 'For the resolution' : 'Against the resolution'}
        </button>
      ))}
    </div>
  );
}

// ── Flow 1: Add Evidence from a non-Warrant parent ────────────────────────────
// Creates a new Warrant (linked to parent) + new Evidence (linked to the Warrant).

function EvidenceViaWarrantForm({
  parentId, parentType, parentTitle, resolutionId,
  preSelectedDirection, onCreated, onClose,
}: Omit<Props, 'preSelectedType' | 'availableStatements' | 'onRelationshipLinked'>) {

  const [warrantTitle,        setWarrantTitle]        = useState('');
  const [warrantDirection,    setWarrantDirection]    = useState<'for' | 'against' | ''>('');
  const [warrantDescription,  setWarrantDescription]  = useState('');
  const [evidenceTitle,       setEvidenceTitle]       = useState('');
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [saving,              setSaving]              = useState(false);
  const [error,               setError]              = useState('');

  const directionPreset = preSelectedDirection !== undefined;

  const effectiveWarrantDir: 'for' | 'against' | null =
    directionPreset ? (preSelectedDirection ?? null) :
    warrantDirection === 'for' || warrantDirection === 'against' ? warrantDirection : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const wTitle = warrantTitle.trim();
    const eTitle = evidenceTitle.trim();
    if (!wTitle)  { setError('Warrant title is required.'); return; }
    if (!eTitle)  { setError('Evidence title is required.'); return; }
    if (!directionPreset && !warrantDirection) {
      setError('Please select a direction for the Warrant.'); return;
    }
    setSaving(true); setError('');
    try {
      // Step 1 — create Warrant linked to parent
      const wRes = await fetch('/api/statements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentId, resolutionId, statType: 'warrant',
          statTitle: wTitle, statDirection: effectiveWarrantDir,
          statDescription: warrantDescription.trim() || null,
        }),
      });
      if (!wRes.ok) { const d = await wRes.json(); setError(d.error ?? 'Could not create warrant'); return; }
      const { statement: warrant, relationship: wRel } = await wRes.json();
      onCreated(warrant, wRel);

      // Step 2 — create Evidence linked to the new Warrant
      const eRes = await fetch('/api/statements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentId: warrant.id, resolutionId, statType: 'evidence',
          statTitle: eTitle, statDirection: null,
          statDescription: evidenceDescription.trim() || null,
        }),
      });
      if (!eRes.ok) {
        const d = await eRes.json();
        setError(`Warrant created. Evidence failed: ${d.error ?? 'error'}`);
        setTimeout(onClose, 2000); return;
      }
      const { statement: evidence, relationship: eRel } = await eRes.json();
      onCreated(evidence, eRel);
      onClose();
    } catch { setError('Network error — please try again.'); }
    finally { setSaving(false); }
  }

  return (
    <ModalShell title="Add Evidence + Warrant" onClose={onClose}
      subtitle={`Evidence links via a Warrant — both will be created. Supporting: ${parentTitle}`}>
      <form onSubmit={handleSubmit}>
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {error && <ErrorBox>{error}</ErrorBox>}

          {/* Warrant */}
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-4">
            <StepLabel step={1} type="warrant" suffix={`— links to ${STAT_LABEL[parentType] ?? parentType}`} />
            <Field label="Warrant title" required>
              <input type="text" value={warrantTitle} onChange={e => setWarrantTitle(e.target.value)}
                maxLength={510} placeholder="What reasoning connects this evidence to the claim?"
                className={inputCls('violet')} />
            </Field>
            {directionPreset && preSelectedDirection ? (
              <DirectionBadge dir={preSelectedDirection} />
            ) : (
              <Field label="Direction" required>
                <DirectionPicker value={warrantDirection} onChange={setWarrantDirection} />
              </Field>
            )}
            <Field label="Warrant detail" optional>
              <textarea value={warrantDescription} onChange={e => setWarrantDescription(e.target.value)}
                rows={3} maxLength={2010} placeholder="Expand the reasoning, add context…"
                className={textareaCls('violet')} />
            </Field>
          </div>

          {/* Evidence */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-4">
            <StepLabel step={2} type="evidence" suffix="— links to the Warrant above" />
            <Field label="Evidence title" required>
              <input type="text" value={evidenceTitle} onChange={e => setEvidenceTitle(e.target.value)}
                maxLength={510} placeholder="Specific data, statistic, study, or source…"
                className={inputCls('emerald')} />
            </Field>
            <Field label="Evidence detail" optional>
              <textarea value={evidenceDescription} onChange={e => setEvidenceDescription(e.target.value)}
                rows={3} maxLength={2010} placeholder="Full citation, methodology, additional context…"
                className={textareaCls('emerald')} />
            </Field>
          </div>
        </div>
        <ModalFooter saving={saving} label="Add Warrant + Evidence" onClose={onClose} />
      </form>
    </ModalShell>
  );
}

// ── Flow 2: Add Warrant with optional existing-evidence linking ────────────────
// Creates a new Warrant, then links selected existing Evidence statements to it.

function WarrantWithEvidenceForm({
  parentId, parentType, parentTitle, resolutionId,
  preSelectedDirection, availableStatements,
  onCreated, onRelationshipLinked, onClose,
}: Omit<Props, 'preSelectedType'>) {

  const evidenceOptions = (availableStatements ?? []).filter(s => s.stat_type === 'evidence');

  const [title,            setTitle]            = useState('');
  const [direction,        setDirection]        = useState<'for' | 'against' | ''>('');
  const [description,      setDescription]      = useState('');
  const [selectedEvidence, setSelectedEvidence] = useState<Set<string>>(new Set());
  const [saving,           setSaving]           = useState(false);
  const [error,            setError]            = useState('');

  const directionPreset = preSelectedDirection !== undefined;
  const effectiveDir: 'for' | 'against' | null =
    directionPreset ? (preSelectedDirection ?? null) :
    direction === 'for' || direction === 'against' ? direction : null;

  function toggleEvidence(id: string) {
    setSelectedEvidence(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimTitle = title.trim();
    if (!trimTitle) { setError('Warrant title is required.'); return; }
    if (!directionPreset && !direction) { setError('Please select a direction.'); return; }
    setSaving(true); setError('');
    try {
      // Create Warrant
      const res = await fetch('/api/statements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentId, resolutionId, statType: 'warrant',
          statTitle: trimTitle, statDirection: effectiveDir,
          statDescription: description.trim() || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Could not create warrant'); return; }
      const { statement: warrant, relationship: wRel } = await res.json();
      onCreated(warrant, wRel);

      // Link selected existing evidence to the new Warrant
      for (const evidenceId of selectedEvidence) {
        try {
          const lRes = await fetch('/api/relationships', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parentId: warrant.id, childId: evidenceId }),
          });
          if (lRes.ok) {
            const { relationship } = await lRes.json();
            onRelationshipLinked?.(relationship);
          }
        } catch { /* silent — warrant already created */ }
      }

      onClose();
    } catch { setError('Network error — please try again.'); }
    finally { setSaving(false); }
  }

  return (
    <ModalShell title="Add Warrant" onClose={onClose}
      subtitle={`Supporting: ${parentTitle}`}>
      <form onSubmit={handleSubmit}>
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {error && <ErrorBox>{error}</ErrorBox>}

          {/* Warrant fields */}
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-bold border ${STAT_BADGE.warrant}`}>Warrant</span>
            </div>
            <Field label="Warrant title" required>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                maxLength={510} placeholder="Reasoning that explains why the claim holds…"
                className={inputCls('violet')} />
            </Field>
            {directionPreset && preSelectedDirection ? (
              <DirectionBadge dir={preSelectedDirection} />
            ) : (
              <Field label="Direction" required>
                <DirectionPicker value={direction} onChange={setDirection} />
              </Field>
            )}
            <Field label="Detail" optional>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                rows={3} maxLength={2010} placeholder="Expand the reasoning, add context…"
                className={textareaCls('violet')} />
            </Field>
          </div>

          {/* Existing evidence linking */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
              Link existing evidence{' '}
              <span className="text-slate-600 normal-case font-normal">(optional)</span>
            </p>
            {evidenceOptions.length === 0 ? (
              <p className="text-xs text-slate-600 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-3">
                No evidence statements in this debate yet. Add evidence after creating this warrant.
              </p>
            ) : (
              <div className="rounded-xl border border-slate-700 divide-y divide-slate-800 overflow-hidden">
                {evidenceOptions.map(ev => {
                  const checked = selectedEvidence.has(ev.id);
                  return (
                    <label key={ev.id}
                      className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                        checked ? 'bg-emerald-500/10' : 'hover:bg-slate-800/40'
                      }`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEvidence(ev.id)}
                        className="mt-0.5 flex-shrink-0 accent-emerald-500"
                      />
                      <span className="text-sm text-slate-300 leading-snug">{ev.stat_title}</span>
                    </label>
                  );
                })}
              </div>
            )}
            {selectedEvidence.size > 0 && (
              <p className="mt-1.5 text-[10px] text-slate-500">
                {selectedEvidence.size} evidence statement{selectedEvidence.size !== 1 ? 's' : ''} will be linked to this warrant.
              </p>
            )}
          </div>
        </div>
        <ModalFooter saving={saving} label="Add Warrant" onClose={onClose} />
      </form>
    </ModalShell>
  );
}

// ── Flow 3: Standard single-statement creation ────────────────────────────────

function StandardForm({
  parentId, parentType, parentTitle, resolutionId,
  preSelectedType, preSelectedDirection,
  onCreated, onClose,
}: Omit<Props, 'availableStatements' | 'onRelationshipLinked'>) {

  const allowedTypes = PF_ALLOWED_CHILDREN[parentType] ?? [];
  const [statType,    setStatType]    = useState(preSelectedType ?? allowedTypes[0] ?? '');
  const [title,       setTitle]       = useState('');
  const [direction,   setDirection]   = useState<'for' | 'against' | ''>('');
  const [description, setDescription] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  const directionPreset = preSelectedDirection !== undefined;
  const directionMode   = TYPE_DIRECTION_MODE[statType] ?? 'user';

  const effectiveDirection: 'for' | 'against' | null =
    directionPreset       ? (preSelectedDirection ?? null) :
    directionMode === 'neutral'      ? null :
    directionMode === 'auto-against' ? 'against' :
    direction === 'for' || direction === 'against' ? direction : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimTitle = title.trim();
    if (!trimTitle) { setError('Statement title is required.'); return; }
    if (!directionPreset && directionMode === 'user' && !direction) {
      setError('Please select a direction (For or Against).'); return;
    }
    setError(''); setSaving(true);
    try {
      const res = await fetch('/api/statements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentId, resolutionId, statType, statTitle: trimTitle,
          statDirection: effectiveDirection, statDescription: description.trim() || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Could not create statement'); return; }
      const { statement, relationship } = await res.json();
      onCreated(statement, relationship);
      onClose();
    } catch { setError('Network error — please try again.'); }
    finally { setSaving(false); }
  }

  return (
    <ModalShell title="Add Connected Statement" onClose={onClose}
      subtitle={`Supporting: ${parentTitle}`}>
      <form onSubmit={handleSubmit}>
        <div className="px-6 py-5 space-y-5">
          {error && <ErrorBox>{error}</ErrorBox>}

          {/* Type selector */}
          {preSelectedType ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Type</label>
                <span className={`rounded-lg px-3 py-1.5 text-xs font-bold border ${STAT_BADGE[statType] ?? 'bg-slate-700 text-slate-200 border-slate-600'}`}>
                  {STAT_LABEL[statType] ?? statType}
                </span>
              </div>
              {directionPreset && preSelectedDirection && <DirectionBadge dir={preSelectedDirection} />}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Statement type</label>
              <div className="flex flex-wrap gap-2">
                {allowedTypes.map(type => (
                  <button key={type} type="button"
                    onClick={() => { setStatType(type); setDirection(''); }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold border transition-all ${
                      statType === type
                        ? (STAT_BADGE[type] ?? 'bg-blue-600 text-white border-blue-500') + ' ring-2 ring-white/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                    }`}>
                    {STAT_LABEL[type] ?? type}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Direction */}
          {!directionPreset && directionMode === 'user' && (
            <Field label="Direction" required>
              <DirectionPicker value={direction} onChange={setDirection} />
            </Field>
          )}
          {!directionPreset && directionMode === 'auto-against' && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/30 px-3 py-2">
              <svg className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
              <span className="text-xs text-slate-500">
                A {STAT_LABEL[statType]} is always directed <strong className="text-slate-400">against</strong> the statement it challenges.
              </span>
            </div>
          )}

          {/* Title */}
          <Field label="Statement title" required>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              maxLength={510}
              placeholder={`Enter your ${STAT_LABEL[statType]?.toLowerCase() ?? 'statement'} here…`}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-600" />
            <p className="mt-1 text-right text-xs text-slate-600">{title.length}/510</p>
          </Field>

          {/* Description */}
          <Field label="Description / supporting detail" optional>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={6} maxLength={2010}
              placeholder="Expand on the statement, add context, cite sources…"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none placeholder-slate-600" />
          </Field>
        </div>
        <ModalFooter saving={saving} label={`Add ${STAT_LABEL[statType] ?? 'Statement'}`} disabled={!statType} onClose={onClose} />
      </form>
    </ModalShell>
  );
}

// ── Router: chooses which flow to use ─────────────────────────────────────────

export default function CreateStatementModal(props: Props) {
  const { parentType, preSelectedType, availableStatements, onCreated, onRelationshipLinked, onClose } = props;
  const allowedTypes = PF_ALLOWED_CHILDREN[parentType] ?? [];
  const resolvedType = preSelectedType ?? allowedTypes[0] ?? '';

  // Flow 1: evidence from non-warrant → combined evidence+warrant creation
  if (resolvedType === 'evidence' && parentType !== 'warrant') {
    return (
      <EvidenceViaWarrantForm
        parentId={props.parentId}
        parentType={props.parentType}
        parentTitle={props.parentTitle}
        resolutionId={props.resolutionId}
        preSelectedDirection={props.preSelectedDirection}
        onCreated={onCreated}
        onClose={onClose}
      />
    );
  }

  // Flow 2: warrant creation → with optional existing-evidence linking
  if (resolvedType === 'warrant') {
    return (
      <WarrantWithEvidenceForm
        parentId={props.parentId}
        parentType={props.parentType}
        parentTitle={props.parentTitle}
        resolutionId={props.resolutionId}
        preSelectedDirection={props.preSelectedDirection}
        availableStatements={availableStatements}
        onCreated={onCreated}
        onRelationshipLinked={onRelationshipLinked}
        onClose={onClose}
      />
    );
  }

  // Flow 3: everything else
  return <StandardForm {...props} />;
}

// ── Micro-components ──────────────────────────────────────────────────────────

function ModalShell({ title, subtitle, onClose, children }: {
  title: string; subtitle: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#0c1322] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-100">{title}</h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-md">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ saving, label, disabled, onClose }: {
  saving: boolean; label: string; disabled?: boolean; onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-800">
      <button type="submit" disabled={saving || disabled}
        className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors">
        {saving ? 'Creating…' : label}
      </button>
      <button type="button" onClick={onClose}
        className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
        Cancel
      </button>
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
      {children}
    </div>
  );
}

function Field({ label, required, optional, children }: {
  label: string; required?: boolean; optional?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
        {optional && <span className="text-slate-600 normal-case font-normal ml-1">(optional)</span>}
      </label>
      {children}
    </div>
  );
}

function StepLabel({ step, type, suffix }: { step: number; type: string; suffix: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Step {step}</span>
      <span className={`rounded px-2 py-0.5 text-xs font-bold border ${STAT_BADGE[type]}`}>
        {STAT_LABEL[type] ?? type}
      </span>
      <span className="text-xs text-slate-500">{suffix}</span>
    </div>
  );
}

function DirectionBadge({ dir }: { dir: 'for' | 'against' }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Direction</label>
      <span className={`rounded px-2.5 py-1 text-xs font-bold border ${
        dir === 'for'
          ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
          : 'bg-rose-500/20 text-rose-200 border-rose-500/40'
      }`}>
        {dir === 'for' ? 'For the resolution' : 'Against the resolution'}
      </span>
    </div>
  );
}

function inputCls(color: 'violet' | 'emerald') {
  const f = color === 'violet'
    ? 'focus:border-violet-500 focus:ring-violet-500'
    : 'focus:border-emerald-500 focus:ring-emerald-500';
  return `w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 ${f} focus:outline-none focus:ring-1 placeholder-slate-600`;
}

function textareaCls(color: 'violet' | 'emerald') {
  const f = color === 'violet'
    ? 'focus:border-violet-500 focus:ring-violet-500'
    : 'focus:border-emerald-500 focus:ring-emerald-500';
  return `w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 ${f} focus:outline-none focus:ring-1 resize-none placeholder-slate-600`;
}
