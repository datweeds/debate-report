'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import RichText from '@/components/discussions/RichText';
import { openItemText } from '@/components/sealed/items';
import { REF_ICON, type Ref } from '@/lib/refs';
import { keysForSealed, resolveRef, type Resolved } from './resolve';
import RefHtml from './RefHtml';

// A referenced item's read-only preview. It links to the item itself (where its
// author or a moderator can edit it). References inside it open further
// previews on top; Escape or a click outside closes only the top one.

const stack: string[] = [];
const PREVIEW = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'text/plain']);
const btn = 'rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-blue-500/60 hover:bg-blue-500/10';
const primary = 'rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500';

const day = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const bytes = (n: number | null | undefined) => n == null ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;

function when(e: Resolved) {
  const s = new Date(e.starts_at!), en = e.ends_at ? new Date(e.ends_at) : null;
  const dOpts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' };
  if (e.all_day) {
    const a = s.toLocaleDateString('en-GB', { ...dOpts, timeZone: 'UTC' });
    const b = en?.toLocaleDateString('en-GB', { ...dOpts, timeZone: 'UTC' });
    return !b || b === a ? `${a} · all day` : `${a} – ${b}`;
  }
  const t = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (!en) return `${s.toLocaleDateString('en-GB', dOpts)} · ${t(s)}`;
  if (s.toDateString() === en.toDateString()) return `${s.toLocaleDateString('en-GB', dOpts)} · ${t(s)}–${t(en)}`;
  return `${s.toLocaleDateString('en-GB', dOpts)} ${t(s)} – ${en.toLocaleDateString('en-GB', dOpts)} ${t(en)}`;
}

/** Where the item lives: the page to open it on (and edit it, for those allowed). */
function homeOf(v: Resolved): { href: string; label: string } {
  const s = `/society/${v.society}`;
  const folder = v.folder_id ? `folder=${v.folder_id}&` : '';
  switch (v.kind) {
    case 'note': return { href: `${s}/documents?${folder}note=${v.id}`, label: 'Open in Documents' };
    case 'doc': return { href: `${s}/documents${v.folder_id ? `?folder=${v.folder_id}` : ''}`, label: 'Open in Documents' };
    case 'event': return { href: `${s}/events?event=${v.id}`, label: 'Open in Calendar' };
    case 'thread': return { href: `${s}/discussions/${v.id}`, label: 'Open discussion' };
  }
}

// A note's text: fetched when previewed (it counts as an open), opened if sealed
function NoteText({ v }: { v: Resolved }) {
  const [html, setHtml] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    (async () => {
      const res = await fetch(`/api/societies/${v.society}/documents/${v.id}`);
      if (!res.ok) { if (live) setHtml(null); return; }
      const { note } = await res.json() as { note: { body: string | null; seal_root: string | null } };
      let body = note.body ?? '';
      if (body.startsWith('sn1:')) {
        const keys = note.seal_root ? await keysForSealed(v.society, { type: 'folder', id: note.seal_root }) : null;
        try { body = (keys && openItemText(keys, body)) ?? ''; } catch { body = ''; }
        if (!keys || !body) { if (live) setHtml(null); return; }
      }
      if (live) setHtml(body);
    })().catch(() => { if (live) setHtml(null); });
    return () => { live = false; };
  }, [v.society, v.id]);
  if (html === undefined) return <div className="h-24 animate-pulse rounded-lg bg-slate-800/40" />;
  if (html === null) return <p className="text-sm italic text-slate-500">This note can’t be opened here.</p>;
  return <RefHtml html={html} empty="This note is empty." />;
}

function Body({ v }: { v: Resolved }) {
  const docsApi = `/api/societies/${v.society}/documents/${v.id}`;
  if (v.locked) {
    return <p className="text-sm text-slate-400">🔐 This is sealed. Open it with your secure access to read it: use the button below, then unlock when asked.</p>;
  }
  if (v.kind === 'note') return <NoteText v={v} />;
  if (v.kind === 'event') return (
    <div className="space-y-3">
      <p className="text-sm text-blue-300">{when(v)}</p>
      {v.location && <div className="flex gap-2 text-sm text-slate-300"><span aria-hidden>📍</span><RichText text={v.location} /></div>}
      {v.description ? <RichText text={v.description} /> : <p className="text-sm italic text-slate-500">No details.</p>}
    </div>
  );
  if (v.kind === 'thread') return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">{v.posts} message{v.posts === 1 ? '' : 's'}{v.locked ? ' · locked' : ''} · the first:</p>
      {v.first ? <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 px-3 py-2"><RichText text={v.first} /></div>
        : <p className="text-sm italic text-slate-500">No messages yet.</p>}
    </div>
  );
  // A file or a link
  const canPreview = v.docKind === 'file' && !v.sealed && !!v.mime_type && PREVIEW.has(v.mime_type);
  return (
    <div className="space-y-3">
      {v.description && <p className="whitespace-pre-wrap text-sm text-slate-300">{v.description}</p>}
      {v.docKind === 'link' && v.url && <p className="break-all text-xs text-slate-500">{v.url}</p>}
      {v.docKind === 'file' && <p className="text-xs text-slate-500">{v.file_name} · {bytes(v.size_bytes)}</p>}
      {canPreview && (v.mime_type!.startsWith('image/')
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={`${docsApi}/file`} alt={v.title} className="mx-auto max-h-[55vh] max-w-full rounded-lg object-contain" />
        : <iframe src={`${docsApi}/file`} title={v.title} className="h-[55vh] w-full rounded-lg border-0 bg-white" />)}
    </div>
  );
}

function Actions({ v }: { v: Resolved }) {
  const docsApi = `/api/societies/${v.society}/documents/${v.id}`;
  const home = homeOf(v);
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {!v.locked && v.docKind === 'link' && v.url && (
        <a href={v.sealed ? v.url : `${docsApi}/open`} target="_blank" rel="noopener noreferrer nofollow" className={btn}>Open link ↗</a>
      )}
      {!v.locked && v.docKind === 'file' && !v.sealed && <a href={`${docsApi}/file?download=1`} className={btn}>Download</a>}
      <a href={home.href} className={primary}>{home.label} →</a>
    </div>
  );
}

export default function RefPopup({ r, onClose }: { r: Ref; onClose: () => void }) {
  const me = useId();
  const [v, setV] = useState<Resolved | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    resolveRef(r, true).then(x => { if (live) setV(x); }).catch(() => { if (live) setV(null); });
    return () => { live = false; };
  }, [r]);

  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    stack.push(me);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || stack[stack.length - 1] !== me) return;
      e.stopImmediatePropagation(); e.preventDefault(); close.current();
    };
    window.addEventListener('keydown', onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      stack.splice(stack.indexOf(me), 1);
      document.body.style.overflow = overflow;
    };
  }, [me]);

  const title = v ? v.title : v === null ? 'Not available' : 'Loading…';
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-2 backdrop-blur-sm sm:p-6"
      onClick={e => { e.stopPropagation(); onClose(); }} role="dialog" aria-modal="true" aria-label={`Preview: ${title}`}>
      <div className="dr-panel flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-2 border-b border-slate-700/60 px-5 py-3">
          <span className="mt-0.5 text-base" aria-hidden>{REF_ICON[v?.kind ?? r.kind]}</span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-slate-100">{v?.sealed && !v.locked && <span className="mr-1" title="Sealed: end-to-end encrypted">🔐</span>}{title}</p>
            {v && <p className="text-[11px] text-slate-500">Preview{v.author ? ` · @${v.author}` : ''} · {day(v.created_at)}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-700/50 hover:text-white">×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {v === undefined ? <div className="h-24 animate-pulse rounded-lg bg-slate-800/40" />
            : v === null ? <p className="text-sm text-slate-400">This has been deleted, or you don’t have access to it.</p>
            : <Body v={v} />}
        </div>
        {v && <div className="border-t border-slate-700/60 px-5 py-3"><Actions v={v} /></div>}
      </div>
    </div>,
    document.body,
  );
}
