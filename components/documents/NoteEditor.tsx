'use client';

import { useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { cleanNoteHtml, noteIsEmpty } from './noteHtml';
import RefPicker from '@/components/refs/RefPicker';
import { REF_NAME } from '@/lib/refs';

const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none';

function Tool({ on, active, label, title }: { on: () => void; active?: boolean; label: React.ReactNode; title: string }) {
  return (
    <button type="button" onMouseDown={e => e.preventDefault()} onClick={on} title={title} aria-label={title} aria-pressed={!!active}
      className={`min-w-[2rem] rounded px-2 py-1 text-xs font-semibold transition-colors ${active ? 'bg-blue-500/25 text-blue-200' : 'text-slate-300 hover:bg-slate-700/60'}`}>
      {label}
    </button>
  );
}

export function Toolbar({ editor, onRef }: { editor: Editor; onRef: () => void }) {
  const c = () => editor.chain().focus();
  function link() {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = prompt('Link address (leave empty to remove the link)', prev ?? 'https://');
    if (url === null) return;
    if (!url.trim() || url.trim() === 'https://') { c().extendMarkRange('link').unsetLink().run(); return; }
    const href = /^(https?:|mailto:)/i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    c().extendMarkRange('link').setLink({ href }).run();
  }
  const sep = <span className="mx-1 h-4 w-px bg-slate-700" />;
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-700 bg-slate-900/60 px-2 py-1.5">
      <Tool on={() => c().toggleBold().run()} active={editor.isActive('bold')} label={<b>B</b>} title="Bold" />
      <Tool on={() => c().toggleItalic().run()} active={editor.isActive('italic')} label={<i>I</i>} title="Italic" />
      <Tool on={() => c().toggleUnderline().run()} active={editor.isActive('underline')} label={<u>U</u>} title="Underline" />
      <Tool on={() => c().toggleStrike().run()} active={editor.isActive('strike')} label={<s>S</s>} title="Strikethrough" />
      {sep}
      <Tool on={() => c().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} label="H2" title="Heading" />
      <Tool on={() => c().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} label="H3" title="Subheading" />
      {sep}
      <Tool on={() => c().toggleBulletList().run()} active={editor.isActive('bulletList')} label="• List" title="Bulleted list" />
      <Tool on={() => c().toggleOrderedList().run()} active={editor.isActive('orderedList')} label="1. List" title="Numbered list" />
      <Tool on={() => c().toggleBlockquote().run()} active={editor.isActive('blockquote')} label="❝" title="Quote" />
      <Tool on={link} active={editor.isActive('link')} label="🔗" title="Link" />
      <Tool on={onRef} label="📎" title="Reference a note, document, event or discussion (opens as a preview)" />
      {sep}
      <Tool on={() => c().undo().run()} label="↶" title="Undo" />
      <Tool on={() => c().redo().run()} label="↷" title="Redo" />
    </div>
  );
}

// Write or edit a note. Closes only with Save or Cancel (not a click outside),
// and asks before throwing away changes.
export default function NoteEditor({ society, noteId, initial, isNew, sealed, folders, onSave, onClose }: {
  society: number; noteId?: string;
  initial: { title: string; body: string; folderId: string };
  isNew: boolean;
  sealed: boolean;                                   // encrypted in this browser before it's saved
  folders: { id: string; full_path: string }[] | null; // where it can be moved (null: not movable)
  onSave: (v: { title: string; body: string; folderId: string }) => Promise<string | null>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [folderId, setFolderId] = useState(initial.folderId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [picking, setPicking] = useState(false);
  const [startBody] = useState(() => cleanNoteHtml(initial.body));
  const editor = useEditor({
    extensions: [StarterKit.configure({
      heading: { levels: [2, 3, 4] },
      link: { openOnClick: false, autolink: true, protocols: ['http', 'https', 'mailto'], HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } },
    })],
    content: startBody,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    onUpdate: () => setDirty(true),
    editorProps: { attributes: { class: 'note-html tiptap min-h-[16rem] px-4 py-3 text-sm text-slate-100 focus:outline-none', 'aria-label': 'Note' } },
  });

  const html = () => (editor && !noteIsEmpty(editor.getHTML()) ? editor.getHTML() : '');
  const changed = () => dirty || title !== initial.title || folderId !== initial.folderId;

  function cancel() {
    if (changed() && !confirm('Discard the changes to this note?')) return;
    onClose();
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Give the note a title'); return; }
    setSaving(true); setError('');
    const problem = await onSave({ title: title.trim(), body: html(), folderId });
    setSaving(false);
    if (problem) setError(problem);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/70 p-2 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={isNew ? 'New note' : 'Edit note'}>
      <form onSubmit={save} className="dr-panel my-auto flex w-full max-w-3xl flex-col gap-3 rounded-2xl p-4 shadow-2xl sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-100">{sealed && <span className="mr-1" title="Sealed: end-to-end encrypted">🔐</span>}{isNew ? 'New note' : 'Edit note'}</h3>
          <button type="button" onClick={cancel} aria-label="Close" className="rounded-lg px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-700/50 hover:text-white">×</button>
        </div>
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} required placeholder="Title" className={inputCls} autoFocus={isNew} />
        <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900 focus-within:border-blue-500">
          {editor && <Toolbar editor={editor} onRef={() => setPicking(true)} />}
          <div className="max-h-[55vh] overflow-y-auto"><EditorContent editor={editor} /></div>
        </div>
        {folders && (
          <select value={folderId} onChange={e => setFolderId(e.target.value)} aria-label="Folder" className={inputCls}>
            <option value="root">Documents (top level)</option>
            {folders.map(f => <option key={f.id} value={f.id}>{f.full_path}</option>)}
          </select>
        )}
        {picking && editor && (
          <RefPicker society={society} exclude={noteId} onClose={() => setPicking(false)} onPick={p => {
            setPicking(false);
            // A sealed item's name is never written into a note that isn't sealed (readers see its name only if they can open it)
            const text = p.sealed && !sealed ? `Sealed ${REF_NAME[p.ref.kind]}` : p.title;
            editor.chain().focus().insertContent([
              { type: 'text', text, marks: [{ type: 'link', attrs: { href: p.url, target: null } }] },
              { type: 'text', text: ' ' },
            ]).run();
          }} />
        )}
        {sealed && <p className="text-[11px] text-slate-500">This folder is sealed: the note is encrypted in your browser before it’s saved.</p>}
        {error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={saving || !editor} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
            {saving ? 'Saving…' : isNew ? 'Add note' : 'Save'}
          </button>
          <button type="button" onClick={cancel} className="px-2 text-sm text-slate-500 hover:text-slate-300">Cancel</button>
        </div>
      </form>
    </div>
  );
}
