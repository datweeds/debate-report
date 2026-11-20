'use client';

import { useId, useState } from 'react';

export type PrincipleFields = { category: 'rule' | 'aspiration' | 'guideline'; title: string; body: string; grounding: string; section: string; library?: string };

export const CATEGORY_META: Record<PrincipleFields['category'], { label: string; plural: string; cls: string }> = {
  rule:       { label: 'Rule',       plural: 'Rules',       cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  aspiration: { label: 'Aspiration', plural: 'Aspirations', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  guideline:  { label: 'Guideline',  plural: 'Guidelines',  cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
};

const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none';

// Add / edit one principle: Society principles and the SysAdmin library share it.
export default function PrincipleForm({ initial, onSave, onCancel, saveLabel = 'Save', sections = [], libraries }: {
  initial?: Partial<PrincipleFields>; onSave: (p: PrincipleFields) => Promise<string | null>; onCancel: () => void; saveLabel?: string;
  sections?: string[];      // existing sections, offered as suggestions (typing a new one creates it)
  libraries?: string[];     // Admin library editor: which library it belongs to
}) {
  const [f, setF] = useState<PrincipleFields>({
    category: 'rule', title: '', body: '', ...initial,
    grounding: initial?.grounding ?? '', section: initial?.section ?? '', library: initial?.library ?? libraries?.[0],
  });
  const listId = useId();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    const err = await onSave(f);
    setSaving(false);
    if (err) setError(err);
  }
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-700 bg-dr-card p-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(CATEGORY_META) as PrincipleFields['category'][]).map(c => (
          <button key={c} type="button" onClick={() => setF(v => ({ ...v, category: c }))}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${f.category === c ? CATEGORY_META[c].cls : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}>
            {CATEGORY_META[c].label}
          </button>
        ))}
      </div>
      <div className={`grid gap-2 ${libraries ? 'sm:grid-cols-2' : ''}`}>
        {libraries && (
          <input value={f.library ?? ''} onChange={e => setF(v => ({ ...v, library: e.target.value }))} list={`${listId}-lib`} required maxLength={60} placeholder="Library (e.g. Debating)" className={inputCls} />
        )}
        <input value={f.section} onChange={e => setF(v => ({ ...v, section: e.target.value }))} list={listId} maxLength={80} placeholder="Section (e.g. Conduct, Privacy) — optional" className={inputCls} />
      </div>
      <datalist id={listId}>{sections.map(s => <option key={s} value={s} />)}</datalist>
      {libraries && <datalist id={`${listId}-lib`}>{libraries.map(s => <option key={s} value={s} />)}</datalist>}
      <input value={f.title} onChange={e => setF(v => ({ ...v, title: e.target.value }))} required maxLength={200} placeholder="Principle (short title)" className={inputCls} autoFocus />
      <textarea value={f.body} onChange={e => setF(v => ({ ...v, body: e.target.value }))} required rows={3} maxLength={5000} placeholder="What it means in practice" className={inputCls} />
      <textarea value={f.grounding} onChange={e => setF(v => ({ ...v, grounding: e.target.value }))} rows={2} maxLength={3000} placeholder="Why (optional): the reasoning behind it" className={inputCls} />
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">{saving ? 'Saving…' : saveLabel}</button>
        <button type="button" onClick={onCancel} className="px-2 text-sm text-slate-500 hover:text-slate-300">Cancel</button>
      </div>
    </form>
  );
}
