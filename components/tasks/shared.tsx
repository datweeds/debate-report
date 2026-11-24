'use client';

// Shared bits for the Tasks screens.

import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Toolbar } from '@/components/documents/NoteEditor';
import { cleanNoteHtml, noteIsEmpty } from '@/components/documents/noteHtml';
import RefPicker from '@/components/refs/RefPicker';
import { REF_NAME } from '@/lib/refs';

export { TASK_STATUS } from '@/components/projects/shared';

export type Swatch = { id: string; name: string; color: string; sort_order: number };
export type Person = { id: string; handle: string };

export type QuickTask = {
  id: string; number: number; name: string; description: string | null; notes: string | null;
  status: string; priority_id: string | null; shared_all: boolean; due_date: string | null;
  created_at: string; updated_at: string | null; completed_at: string | null;
  mine: boolean; owner: string | null; shares: Person[] | null; categories: string[];
};
export type ProjectTask = {
  id: string; project_id: string; project: string; protection: string; name: string;
  description: string | null; comments: string | null; status: string; due_date: string | null;
  created_at: string; updated_at: string | null; assigned_to_me: boolean; assignees: Person[]; categories: string[];
  locked?: boolean;   // sealed, and this device can't open it
};
export type ConvertTarget = { id: string; name: string; groups: { id: string; name: string }[] };
export type TasksData = {
  me: string | null; priorities: Swatch[]; categories: Swatch[]; canManagePriorities: boolean;
  readOnly?: boolean;   // the demo Society, for someone who isn't a member: look only
  tasks: QuickTask[]; projectTasks: ProjectTask[]; convertTargets: ConvertTarget[]; projectsOn: boolean;
  priorityCounts?: Record<string, { n: number; open: number }>;
};

export const taskNo = (n: number) => `T-${String(n).padStart(4, '0')}`;
export const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none';
export const smallInput = 'rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none';
export const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const fmtDay = (d: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
export const overdue = (due: string | null, status: string) => !!due && status !== 'complete' && due < todayKey();
export const plain = (html: string | null) => (html ?? '').replace(/<\/(p|li|h\d|blockquote)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();

export function Chip({ s, onRemove, dim }: { s: Pick<Swatch, 'name' | 'color'>; onRemove?: () => void; dim?: boolean }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1 truncate rounded-full border px-2 py-px text-[11px] font-medium ${dim ? 'opacity-50' : ''}`}
      style={{ background: s.color + '26', color: s.color, borderColor: s.color + '80' }}>
      <span className="truncate">{s.name}</span>
      {onRemove && <button type="button" onClick={onRemove} aria-label={`Remove ${s.name}`} className="leading-none opacity-70 hover:opacity-100">×</button>}
    </span>
  );
}

export async function send(url: string, method: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

/** A pop-up frame. Edit boxes stay open on a click outside (keepOpen); previews close. Escape asks onClose (an editor's onClose checks for unsaved changes). */
export function Modal({ children, onClose, keepOpen, label, wide }: {
  children: React.ReactNode; onClose: () => void; keepOpen?: boolean; label: string; wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose, keepOpen]);
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/70 p-2 backdrop-blur-sm sm:p-6"
      onClick={keepOpen ? undefined : onClose} role="dialog" aria-modal="true" aria-label={label}>
      <div className={`dr-panel my-auto w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-2xl p-4 shadow-2xl sm:p-5`} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/** A rich-text box (bold, lists, links, references) for a task's description or notes. */
export function RichField({ society, value, onChange, label }: {
  society: number; value: string; onChange: (html: string) => void; label: string;
}) {
  const [start] = useState(() => cleanNoteHtml(value));
  const [picking, setPicking] = useState(false);
  const editor = useEditor({
    extensions: [StarterKit.configure({
      heading: { levels: [2, 3, 4] },
      link: { openOnClick: false, autolink: true, protocols: ['http', 'https', 'mailto'], HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } },
    })],
    content: start,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor: e }) => onChange(noteIsEmpty(e.getHTML()) ? '' : e.getHTML()),
    editorProps: { attributes: { class: 'note-html tiptap min-h-[5rem] px-3 py-2 text-sm text-slate-100 focus:outline-none', 'aria-label': label } },
  });
  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900 focus-within:border-blue-500">
      {editor && <Toolbar editor={editor} onRef={() => setPicking(true)} />}
      <div className="max-h-[32vh] overflow-y-auto"><EditorContent editor={editor} /></div>
      {picking && editor && (
        <RefPicker society={society} onClose={() => setPicking(false)} onPick={p => {
          setPicking(false);
          editor.chain().focus().insertContent([
            { type: 'text', text: p.sealed ? `Sealed ${REF_NAME[p.ref.kind]}` : p.title, marks: [{ type: 'link', attrs: { href: p.url, target: null } }] },
            { type: 'text', text: ' ' },
          ]).run();
        }} />
      )}
    </div>
  );
}
