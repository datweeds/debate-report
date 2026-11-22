'use client';

import ReportButton from '@/components/ReportButton';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DocViewer from './DocViewer';
import ShareDialog from './ShareDialog';
import NoteEditor from './NoteEditor';
import NoteViewer from './NoteViewer';
import RefPopup from '@/components/refs/RefPopup';
import SecureAccessDialog from '@/components/sealed/SecureAccessDialog';
import { useSecureAccess } from '@/components/sealed/useSecureAccess';
import { keysFor, listKeys, newItemKeys, openItemText, sealItemText, sealItemTextOrNull, societyMembers, type ItemKeys } from '@/components/sealed/items';
import { itemAad, openBytes, sealBytes } from '@/lib/sealed/core';

type Folder = { id: string; name: string; item_count: number; seal_root: string | null };
type Item = {
  id: string; kind: 'file' | 'link' | 'note'; title: string; description: string | null; url: string | null;
  file_name: string | null; mime_type: string | null; size_bytes: number | null; created_at: string;
  open_count: number; download_count: number; uploaded_by: string | null; uploader: string | null;
  protection: 'server' | 'sealed'; seal_root: string | null;
};
type Data = {
  folderId: string | null; path: { id: string; name: string; seal_root: string | null }[]; folders: Folder[]; items: Item[];
  me: string | null; canPost: boolean; canModerate: boolean; canTakeDown: boolean; maxBytes: number; maxLabel: string;
  sealed: { id: string; epoch: number; pending: number } | null; canSeal: boolean;
};
const SEALED_FOLDER = 'Sealed folder: its documents (the files themselves, their titles, descriptions and links) and its folder names are end-to-end encrypted, so only members can read them, not new.vote. File types and sizes stay visible. Sealed documents can’t be moved or copied elsewhere, and there is no AI, abuse scanning or Sys Admin emergency access.';
const aadOf = (rootId: string) => itemAad('folder', rootId);

const INLINE = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'text/plain']);
const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none';

function bytes(n: number | null) {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(/\.0$/, '')} MB`;
}
const day = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function TypeIcon({ item }: { item: Item }) {
  const label = item.kind === 'link' ? 'LINK' : item.kind === 'note' ? 'NOTE'
    : (item.file_name?.split('.').pop() ?? 'FILE').toUpperCase().slice(0, 4);
  const colour = item.kind === 'link' ? 'bg-sky-500/15 text-sky-300'
    : item.kind === 'note' ? 'bg-teal-500/15 text-teal-300'
    : item.mime_type === 'application/pdf' ? 'bg-rose-500/15 text-rose-300'
    : item.mime_type?.startsWith('image/') ? 'bg-violet-500/15 text-violet-300'
    : 'bg-emerald-500/15 text-emerald-300';
  return <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${colour}`}>{label}</span>;
}

// A Society's documents and links, organised in folders.
export default function DocumentsBrowser({ societyId }: { societyId: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const folder = params.get('folder');
  const base = `/api/societies/${societyId}`;

  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<'name' | 'date'>('date');
  const [panel, setPanel] = useState<'none' | 'upload' | 'link' | 'folder'>('none');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [form, setForm] = useState({ title: '', description: '', url: '', folderName: '' });
  const [file, setFile] = useState<File | null>(null);
  const [viewing, setViewing] = useState<Item | null>(null);
  const [editing, setEditing] = useState<{ id: string; title: string; description: string; folderId: string } | null>(null);
  const [allFolders, setAllFolders] = useState<{ id: string; full_path: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  // Moving/copying to another Society this moderator runs
  const [targets, setTargets] = useState<{ societies: { id: number; name: string; current?: boolean }[]; folders: { id: string; customer_id: number; full_path: string }[]; current?: number } | null>(null);
  const [sending, setSending] = useState<{ type: 'doc' | 'folder'; id: string; name: string } | null>(null);
  const [sendTo, setSendTo] = useState({ society: '', folder: '', mode: 'copy' as 'copy' | 'move' });
  const [notice, setNotice] = useState('');
  // Sealed folders: names and documents opened here with this person's keys
  const access = useSecureAccess();
  const [raw, setRaw] = useState<Data | null>(null);
  const [rootKeys, setRootKeys] = useState<Map<string, ItemKeys>>(new Map());
  const [keyError, setKeyError] = useState(false);
  const [dialog, setDialog] = useState<'setup' | 'unlock' | null>(null);
  const [sealIt, setSealIt] = useState(false);
  const [converting, setConverting] = useState<string | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState<Item | null>(null);
  // Notes: one being read, and one being written or edited
  type NoteOpen = { id: string; title: string; body: string; byline: string; sealed: boolean; canEdit: boolean };
  const [noteView, setNoteView] = useState<NoteOpen | null>(null);
  const [noteEdit, setNoteEdit] = useState<{ id: string | null; title: string; body: string; folderId: string; sealRoot: string | null } | null>(null);
  const openedNote = useRef<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`${base}/documents${folder ? `?folder=${folder}` : ''}`);
    if (!r.ok) { setError(r.status === 404 ? 'This folder no longer exists.' : 'Could not load documents.'); return; }
    setError('');
    setRaw(await r.json());
  }, [base, folder]);
  useEffect(() => { load(); }, [load]);

  // Keys: the sealed folder we're in (sharing and renewing as needed), and any sealed folders listed here
  const hereRoot = raw?.sealed?.id ?? null;
  const listedRoots = useMemo(() => [...new Set((raw?.folders ?? []).map(f => f.seal_root).filter(Boolean))] as string[], [raw]);
  const [keysReady, setKeysReady] = useState(false);
  useEffect(() => {
    setKeysReady(false);
    if ((!hereRoot && !listedRoots.length) || access.status !== 'ready' || !access.identity) return;
    const me = access.identity;
    (async () => {
      const all = await listKeys(base, 'folder', me);
      if (hereRoot) all.set(hereRoot, await keysFor(base, 'folder', hereRoot, me));
      setRootKeys(all); setKeysReady(true);
    })().catch(() => setKeyError(true));
  }, [hereRoot, listedRoots, access.status, access.identity, base]);
  useEffect(() => {
    if (!raw) return;
    const o = (root: string | null, v: string | null) => (root ? openItemText(rootKeys.get(root), v) : v);
    setData({
      ...raw,
      path: raw.path.map(p => ({ ...p, name: o(p.seal_root, p.name) ?? 'Sealed folder' })),
      folders: raw.folders.map(f => ({ ...f, name: o(f.seal_root, f.name) ?? 'Sealed folder' })),
      items: raw.items.map(i => i.protection !== 'sealed' ? i : {
        ...i, title: o(i.seal_root, i.title) ?? 'Sealed document', description: o(i.seal_root, i.description),
        url: o(i.seal_root, i.url), file_name: o(i.seal_root, i.file_name),
      }),
    });
  }, [raw, rootKeys]);
  const hereKeys = hereRoot ? rootKeys.get(hereRoot) : undefined;
  const canWriteHere = !hereRoot || !!hereKeys?.keys.has(hereKeys.epoch);
  const sealHere = (v: string) => (hereKeys ? sealItemText(hereKeys, v) : v);

  // A sealed file: fetched as stored, opened here
  async function sealedBlob(i: Item): Promise<Blob> {
    const k = i.seal_root ? rootKeys.get(i.seal_root) : undefined;
    const r = await fetch(`${base}/documents/${i.id}/file`);
    const bytes = k && r.ok ? openBytes(k.keys, new Uint8Array(await r.arrayBuffer()), aadOf(k.id)) : null;
    if (!bytes) throw new Error('This document can’t be opened with your keys');
    return new Blob([new Uint8Array(bytes)], { type: i.mime_type || 'application/octet-stream' });
  }
  // The document's plain bytes, for encrypting a private share link's copy
  async function plainBytes(i: Item): Promise<Uint8Array> {
    if (i.protection === 'sealed') return new Uint8Array(await (await sealedBlob(i)).arrayBuffer());
    const r = await fetch(`${base}/documents/${i.id}/file?download=1&share=1`);
    if (!r.ok) throw new Error('Couldn’t fetch the document');
    return new Uint8Array(await r.arrayBuffer());
  }
  async function viewSealed(i: Item) {
    try { setViewUrl(URL.createObjectURL(await sealedBlob(i))); setViewing(i); } catch (e) { setError((e as Error).message); }
  }
  async function downloadSealed(i: Item) {
    try {
      const url = URL.createObjectURL(await sealedBlob(i));
      const a = document.createElement('a'); a.href = url; a.download = i.file_name || i.title; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { setError((e as Error).message); }
  }

  // Seal (or unseal) an existing folder: names first, then each document, converted here
  async function sealFolder(f: Folder) {
    if (!confirm(`Seal the folder “${f.name}” and everything in it?\n\n${SEALED_FOLDER}\n\nEach document is downloaded, encrypted in this browser and uploaded again, which can take a while for large files.`)) return;
    if (access.status !== 'ready') { setDialog(access.status === 'locked' ? 'unlock' : 'setup'); return; }
    setError(''); setConverting('Sealing folder names…');
    try {
      const [{ folders: names }, { members }] = await Promise.all([fetch(`${base}/folders?tree=${f.id}`).then(r => r.json()), societyMembers(base)]);
      const { keys: k, locks } = newItemKeys('folder', f.id, members);
      const r = await fetch(`${base}/folders/${f.id}/seal`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seal', locks, names: names.map((n: { id: string; name: string }) => ({ id: n.id, name: sealItemText(k, n.name) })) }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Couldn’t seal the folder');
      await convertDocs(f.id, k);
      router.push(`/society/${societyId}/documents?folder=${f.id}`);
    } catch (e) { setError((e as Error).message); } finally { setConverting(null); load(); }
  }
  async function convertDocs(rootId: string, k: ItemKeys) {
    const { documents } = await fetch(`${base}/documents?tree=${rootId}`).then(r => r.json());
    const todo = documents.filter((d: { protection: string }) => d.protection === 'server');
    for (const [n, d] of todo.entries()) {
      setConverting(`Sealing documents: ${n + 1} of ${todo.length}`);
      const meta = { title: sealItemText(k, d.title), description: sealItemTextOrNull(k, d.description) ?? '' };
      if (d.kind === 'note') {
        const r = await fetch(`${base}/documents/${d.id}/seal`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'seal', title: meta.title, body: d.body ? sealItemText(k, d.body) : '' }) });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'A note couldn’t be sealed');
        continue;
      }
      if (d.kind === 'link') {
        const r = await fetch(`${base}/documents/${d.id}/seal`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'seal', ...meta, url: sealItemText(k, d.url) }) });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'A link couldn’t be sealed');
        continue;
      }
      const plain = new Uint8Array(await (await fetch(`${base}/documents/${d.id}/file?download=1`)).arrayBuffer());
      const fd = new FormData();
      fd.append('action', 'seal'); fd.append('title', meta.title); fd.append('description', meta.description);
      fd.append('fileName', sealItemText(k, d.file_name || d.title));
      fd.append('file', new Blob([new Uint8Array(sealBytes(k.keys, k.epoch, plain, aadOf(rootId)))]), 'sealed');
      const r = await fetch(`${base}/documents/${d.id}/seal`, { method: 'POST', body: fd });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'A document couldn’t be sealed');
    }
  }
  async function finishSealing() {
    if (!hereRoot || !hereKeys) return;
    setError('');
    try { await convertDocs(hereRoot, hereKeys); } catch (e) { setError((e as Error).message); } finally { setConverting(null); load(); }
  }
  async function unsealFolder() {
    if (!hereRoot || !hereKeys || !confirm('Unseal this folder and everything in it? Documents go back to being encrypted on the server with the Society’s key, so scanning and Sys Admin emergency access can reach them again.')) return;
    setError('');
    try {
      const { documents } = await fetch(`${base}/documents?tree=${hereRoot}`).then(r => r.json());
      const todo = documents.filter((d: { protection: string }) => d.protection === 'sealed');
      const o = (v: string | null) => openItemText(hereKeys, v);
      for (const [n, d] of todo.entries()) {
        setConverting(`Unsealing documents: ${n + 1} of ${todo.length}`);
        if (d.kind === 'note') {
          const [t, b] = [o(d.title), d.body ? o(d.body) : ''];
          if (t == null || b == null) throw new Error('A note can’t be opened with your keys, so the folder can’t be unsealed from here');
          const r = await fetch(`${base}/documents/${d.id}/seal`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'unseal', title: t, body: b }) });
          if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'A note couldn’t be unsealed');
          continue;
        }
        if (d.kind === 'link') {
          const r = await fetch(`${base}/documents/${d.id}/seal`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'unseal', title: o(d.title), description: o(d.description) ?? '', url: o(d.url) }) });
          if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'A link couldn’t be unsealed');
          continue;
        }
        const bytes = openBytes(hereKeys.keys, new Uint8Array(await (await fetch(`${base}/documents/${d.id}/file`)).arrayBuffer()), aadOf(hereRoot));
        if (!bytes) throw new Error('A document can’t be opened with your keys, so the folder can’t be unsealed from here');
        const name = o(d.file_name) || o(d.title) || 'document';
        const fd = new FormData();
        fd.append('action', 'unseal'); fd.append('title', o(d.title) ?? name); fd.append('description', o(d.description) ?? ''); fd.append('fileName', name);
        fd.append('file', new File([new Uint8Array(bytes)], name, { type: d.mime_type || 'application/octet-stream' }));
        const r = await fetch(`${base}/documents/${d.id}/seal`, { method: 'POST', body: fd });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'A document couldn’t be unsealed');
      }
      setConverting('Unsealing folder names…');
      const { folders: names } = await fetch(`${base}/folders?tree=${hereRoot}`).then(r => r.json());
      const r = await fetch(`${base}/folders/${hereRoot}/seal`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unseal', names: names.map((x: { id: string; name: string }) => ({ id: x.id, name: o(x.name) })) }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Couldn’t unseal the folder');
    } catch (e) { setError((e as Error).message); } finally { setConverting(null); load(); }
  }

  useEffect(() => {
    if (!data?.canModerate || targets) return;
    fetch(`${base}/documents/transfer`).then(r => r.ok ? r.json() : null).then(d => setTargets(d ?? { societies: [], folders: [] })).catch(() => {});
  }, [data?.canModerate, base, targets]);
  const canSend = !!targets?.societies.length;
  // Start the dialog on this Society: moving to another folder here is the usual case
  const startSend = (s: { type: 'doc' | 'folder'; id: string; name: string }) => {
    setSending(s); setNotice('');
    setSendTo({ society: targets?.current ? String(targets.current) : '', folder: '', mode: 'move' });
  };

  async function doSend(e: React.FormEvent) {
    e.preventDefault();
    if (!sending) return;
    setBusy(true); setError('');
    const r = await fetch(`${base}/documents/transfer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ type: sending.type, id: sending.id }], targetSocietyId: Number(sendTo.society), targetFolderId: sendTo.folder || null, mode: sendTo.mode }),
    });
    setBusy(false);
    if (!r.ok) { setError((await r.json()).error ?? 'Could not send'); return; }
    const soc = targets?.societies.find(x => String(x.id) === sendTo.society);
    const fold = targets?.folders.find(x => x.id === sendTo.folder)?.full_path ?? 'the top level';
    const where = soc?.current ? fold : `${soc?.name} (${fold})`;
    setNotice(`${sendTo.mode === 'copy' ? 'Copied' : 'Moved'} “${sending.name}” to ${where}.`);
    setSending(null); setTargets(null); load();
  }

  const sorted = useMemo(() => {
    if (!data) return [];
    const items = [...data.items];
    return sort === 'name'
      ? items.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
      : items.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [data, sort]);

  const goFolder = (id: string | null) => router.push(`/society/${societyId}/documents${id ? `?folder=${id}` : ''}`);
  const reset = () => { setPanel('none'); setForm({ title: '', description: '', url: '', folderName: '' }); setFile(null); setError(''); setProgress(null); };

  // XMLHttpRequest rather than fetch, so large uploads can show progress
  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !data) return;
    if (file.size > data.maxBytes) { setError(`Files can be up to ${data.maxLabel}. For anything larger, add a link to where it's stored.`); return; }
    const fd = new FormData();
    if (hereKeys) {
      // A sealed folder: the file and its details are encrypted here before they leave
      const bytes = new Uint8Array(await file.arrayBuffer());
      fd.append('file', new Blob([new Uint8Array(sealBytes(hereKeys.keys, hereKeys.epoch, bytes, aadOf(hereKeys.id)))]), 'sealed');
      fd.append('title', sealHere(form.title.trim() || file.name));
      fd.append('description', form.description.trim() ? sealHere(form.description.trim()) : '');
      fd.append('fileName', sealHere(file.name)); fd.append('mime', file.type || 'application/octet-stream');
    } else {
      fd.append('file', file); fd.append('title', form.title); fd.append('description', form.description);
    }
    if (data.folderId) fd.append('folderId', data.folderId);
    setBusy(true); setError(''); setProgress(0);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${base}/documents`);
    xhr.upload.onprogress = ev => { if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100)); };
    xhr.onload = () => {
      setBusy(false);
      if (xhr.status === 201) { reset(); load(); return; }
      let msg = 'Upload failed';
      try { msg = JSON.parse(xhr.responseText).error ?? msg; } catch { if (xhr.status === 413) msg = 'That file is too large for the server to accept.'; }
      setError(msg); setProgress(null);
    };
    xhr.onerror = () => { setBusy(false); setProgress(null); setError('Upload failed — check your connection and try again.'); };
    xhr.send(fd);
  }

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const r = await fetch(`${base}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hereKeys
        ? { url: sealHere(form.url.trim()), title: sealHere(form.title.trim() || new URL(form.url).hostname), description: form.description.trim() ? sealHere(form.description.trim()) : '', folderId: data?.folderId }
        : { url: form.url, title: form.title, description: form.description, folderId: data?.folderId }),
    });
    setBusy(false);
    if (!r.ok) { setError((await r.json()).error ?? 'Could not add the link'); return; }
    reset(); load();
  }

  async function addFolder(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    let body: object = { name: hereKeys ? sealHere(form.folderName.trim()) : form.folderName, parentId: data?.folderId };
    if (sealIt && !hereRoot) {
      // A new sealed folder, with its own key, for every member with secure access
      if (access.status !== 'ready') { setBusy(false); setDialog(access.status === 'locked' ? 'unlock' : 'setup'); return; }
      const { members } = await societyMembers(base);
      const id = crypto.randomUUID();
      const { keys: k, locks } = newItemKeys('folder', id, members);
      body = { protection: 'sealed', id, locks, name: sealItemText(k, form.folderName.trim()), parentId: data?.folderId };
    }
    const r = await fetch(`${base}/folders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    setBusy(false);
    if (!r.ok) { setError((await r.json()).error ?? 'Could not create the folder'); return; }
    reset(); load();
  }

  async function renameFolder(f: Folder) {
    const name = prompt('Folder name', f.name);
    if (!name?.trim() || name === f.name) return;
    const k = f.seal_root ? rootKeys.get(f.seal_root) : undefined;
    if (f.seal_root && !k) { setError('You don’t have the key for this sealed folder yet'); return; }
    await fetch(`${base}/folders/${f.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: k ? sealItemText(k, name.trim()) : name }) });
    load();
  }

  async function deleteFolder(f: Folder) {
    if (!confirm(`Delete the folder "${f.name}"?`)) return;
    const r = await fetch(`${base}/folders/${f.id}`, { method: 'DELETE' });
    if (!r.ok) setError((await r.json()).error ?? 'Could not delete the folder'); else load();
  }

  async function startEdit(item: Item) {
    setEditing({ id: item.id, title: item.title, description: item.description ?? '', folderId: data?.folderId ?? 'root' });
    if (!allFolders.length) {
      const r = await fetch(`${base}/folders`);
      if (r.ok) setAllFolders((await r.json()).folders);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const r = await fetch(`${base}/documents/${editing.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hereKeys && data?.items.find(i => i.id === editing.id)?.protection === 'sealed'
        ? { title: sealHere(editing.title.trim()), description: editing.description.trim() ? sealHere(editing.description.trim()) : '' }
        : { title: editing.title, description: editing.description, folderId: editing.folderId }),
    });
    if (!r.ok) { setError((await r.json()).error ?? 'Could not save'); return; }
    setEditing(null); load();
  }

  // A note's text: fetched when it's opened (sealed notes are opened with this person's keys)
  async function fetchNote(id: string, edit = false) {
    const r = await fetch(`${base}/documents/${id}${edit ? '?edit=1' : ''}`);
    if (!r.ok) throw new Error('This note couldn’t be opened');
    const { note } = await r.json();
    if (note.protection !== 'sealed') return { ...note, body: note.body ?? '' };
    const k = note.seal_root ? rootKeys.get(note.seal_root) : undefined;
    const title = openItemText(k, note.title), body = note.body ? openItemText(k, note.body) : '';
    if (title == null || body == null) throw new Error('This note is sealed and can’t be opened with your keys yet');
    return { ...note, title, body };
  }
  async function openNote(id: string) {
    setError('');
    try {
      const n = await fetchNote(id);
      const who = data?.items.find(i => i.id === id)?.uploader;
      setNoteView({
        id, title: n.title, body: n.body, sealed: n.protection === 'sealed',
        byline: [who ? `@${who}` : '', day(n.updated_at ?? n.created_at) + (n.updated_at ? ' (edited)' : '')].filter(Boolean).join(' · '),
        canEdit: !!data && (n.uploaded_by === data.me || data.canModerate) && (n.protection !== 'sealed' || !!rootKeys.get(n.seal_root)?.keys.size),
      });
    } catch (e) { setError((e as Error).message); }
  }
  async function editNote(id: string) {
    setError('');
    try {
      const n = await fetchNote(id, true);
      setNoteEdit({ id, title: n.title, body: n.body, folderId: n.folder_id ?? 'root', sealRoot: n.protection === 'sealed' ? n.seal_root : null });
      if (n.protection !== 'sealed' && !allFolders.length) {
        const r = await fetch(`${base}/folders`);
        if (r.ok) setAllFolders((await r.json()).folders);
      }
    } catch (e) { setError((e as Error).message); }
  }
  async function saveNote(v: { title: string; body: string; folderId: string }): Promise<string | null> {
    if (!noteEdit) return null;
    // Sealed: a new note in a sealed folder, or an existing sealed note
    const k = noteEdit.id ? (noteEdit.sealRoot ? rootKeys.get(noteEdit.sealRoot) : undefined) : hereKeys;
    if ((noteEdit.sealRoot || (!noteEdit.id && hereRoot)) && !k?.keys.has(k.epoch)) return 'You don’t have this sealed folder’s current key yet';
    const seal = (s: string) => (k ? sealItemText(k, s) : s);
    const payload = { title: seal(v.title), body: v.body ? seal(v.body) : '' };
    const r = noteEdit.id
      ? await fetch(`${base}/documents/${noteEdit.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(k || v.folderId === noteEdit.folderId ? payload : { ...payload, folderId: v.folderId }) })
      : await fetch(`${base}/documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'note', ...payload, folderId: data?.folderId }) });
    if (!r.ok) return (await r.json().catch(() => ({}))).error ?? 'Could not save the note';
    if (noteEdit.id && noteView?.id === noteEdit.id) setNoteView({ ...noteView, title: v.title, body: v.body });
    setNoteEdit(null); load();
    return null;
  }
  function closeNote() {
    setNoteView(null);
    if (params.get('note')) router.replace(`/society/${societyId}/documents${folder ? `?folder=${folder}` : ''}`);
  }

  async function remove(item: Item) {
    if (!confirm(`Delete "${item.title}"?`)) return;
    await fetch(`${base}/documents/${item.id}`, { method: 'DELETE' });
    load();
  }

  const keysPending = (!!hereRoot || listedRoots.length > 0) && !keysReady && !keyError && (access.status === 'loading' || access.status === 'ready');
  const noteParam = params.get('note');
  // A reference to a file or link: its preview
  const docParam = (() => { const d = params.get('doc'); return d && /^[0-9a-f-]{36}$/i.test(d) ? d : null; })();
  useEffect(() => {
    if (!noteParam || !data || keysPending || openedNote.current === noteParam) return;
    openedNote.current = noteParam;
    void openNote(noteParam);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteParam, data, keysPending]);
  if (!data || keysPending) return error ? <p className="text-sm text-rose-400">{error}</p> : <div className="h-40 rounded-2xl bg-slate-800/40 animate-pulse" />;

  const openHref = (i: Item) => i.kind === 'link' ? `${base}/documents/${i.id}/open` : i.kind === 'note' ? `/society/${societyId}/documents?note=${i.id}` : `${base}/documents/${i.id}/file`;
  const canEdit = (i: Item) => i.uploaded_by === data.me || data.canModerate;
  const canDelete = (i: Item) => i.uploaded_by === data.me || data.canTakeDown;
  // Links for people outside the Society: moderators, files only (sealed ones need this browser to hold the key)
  const shareOutside = (i: Item) => data.canModerate && i.kind === 'file' && (i.protection !== 'sealed' || !!(i.seal_root && rootKeys.get(i.seal_root)?.keys.size));

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Upload from your device or create links or notes online for sharing in the society.</p>
      {viewing && (
        <DocViewer title={viewing.title} fileName={viewing.file_name} mime={viewing.mime_type}
          src={viewing.protection === 'sealed' && viewUrl ? viewUrl : `${base}/documents/${viewing.id}/file`} localFile={viewing.protection === 'sealed'}
          onClose={() => { setViewing(null); if (viewUrl) { URL.revokeObjectURL(viewUrl); setViewUrl(null); } void load(); }} />
      )}
      {docParam && (
        <RefPopup r={{ society: societyId, kind: 'doc', id: docParam }}
          onClose={() => router.replace(`/society/${societyId}/documents${folder ? `?folder=${folder}` : ''}`)} />
      )}
      {noteView && (
        <NoteViewer title={noteView.title} html={noteView.body} byline={noteView.byline} sealed={noteView.sealed} onClose={closeNote}
          onEdit={noteView.canEdit ? () => void editNote(noteView.id) : undefined} />
      )}
      {noteEdit && (
        <NoteEditor key={noteEdit.id ?? 'new'} society={societyId} noteId={noteEdit.id ?? undefined} isNew={!noteEdit.id} sealed={!!(noteEdit.sealRoot || (!noteEdit.id && hereRoot))}
          initial={{ title: noteEdit.title, body: noteEdit.body, folderId: noteEdit.folderId }}
          folders={noteEdit.id && !noteEdit.sealRoot ? allFolders.filter(f => !(f as { sealed?: boolean }).sealed) : null}
          onSave={saveNote} onClose={() => setNoteEdit(null)} />
      )}
      {dialog && <SecureAccessDialog mode={dialog} onDone={() => setDialog(null)} onClose={() => setDialog(null)} />}
      {hereRoot && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs text-slate-300">
          <span className="font-semibold text-emerald-300">🔐 </span>{SEALED_FOLDER}
          {access.status === 'none' && <> <button onClick={() => setDialog('setup')} className="font-semibold text-blue-300 hover:underline">Set up secure access</button> to read it.</>}
          {access.status === 'locked' && <> <button onClick={() => setDialog('unlock')} className="font-semibold text-blue-300 hover:underline">Unlock secure access</button> on this device to read it.</>}
          {access.status === 'ready' && hereKeys && !hereKeys.keys.size && <span className="text-amber-200"> Waiting for access: another member’s browser shares the key next time they open this folder.</span>}
          {data.canModerate && hereKeys?.keys.size ? (
            <span className="ml-1 inline-flex gap-3">
              {(data.sealed?.pending ?? 0) > 0 && <button onClick={finishSealing} disabled={!!converting} className="font-semibold text-amber-300 hover:underline">Finish sealing ({data.sealed!.pending} left)</button>}
              {data.path[data.path.length - 1]?.id === hereRoot && <button onClick={unsealFolder} disabled={!!converting} className="text-slate-400 hover:text-slate-200 hover:underline">Unseal</button>}
            </span>
          ) : null}
        </div>
      )}
      {converting && <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{converting} Keep this page open.</p>}
      {/* Breadcrumb + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <button onClick={() => goFolder(null)} className={data.path.length ? 'text-blue-400 hover:underline' : 'font-semibold text-slate-200'}>Documents</button>
          {data.path.map((p, i) => (
            <span key={p.id} className="flex items-center gap-1">
              <span className="text-slate-600">/</span>
              {i === data.path.length - 1
                ? <span className="font-semibold text-slate-200">{p.name}</span>
                : <button onClick={() => goFolder(p.id)} className="text-blue-400 hover:underline">{p.name}</button>}
            </span>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <select value={sort} onChange={e => setSort(e.target.value as 'name' | 'date')} aria-label="Sort"
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-300">
            <option value="date">Newest first</option>
            <option value="name">Name A–Z</option>
          </select>
          {data.canModerate && canWriteHere && (
            <button onClick={() => setPanel(panel === 'folder' ? 'none' : 'folder')} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500">+ Folder</button>
          )}
          {data.canPost && canWriteHere && (
            <>
              <button onClick={() => { setPanel('none'); setNoteEdit({ id: null, title: '', body: '', folderId: data.folderId ?? 'root', sealRoot: null }); }} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500">+ Note</button>
              <button onClick={() => setPanel(panel === 'link' ? 'none' : 'link')} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500">+ Link</button>
              <button onClick={() => setPanel(panel === 'upload' ? 'none' : 'upload')} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500">Upload</button>
            </>
          )}
        </div>
      </div>

      {error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
      {notice && <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{notice}</p>}

      {sending && targets && (
        <form onSubmit={doSend} className="space-y-3 rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4">
          <p className="text-sm text-slate-200">Move or copy {sending.type === 'folder' ? 'the folder' : ''} “{sending.name}”{sending.type === 'folder' ? ' and everything in it' : ''}</p>
          <div className="flex gap-2">
            {(['copy', 'move'] as const).map(m => (
              <button key={m} type="button" onClick={() => setSendTo(v => ({ ...v, mode: m }))}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${sendTo.mode === m ? 'border-violet-500/60 bg-violet-500/15 text-violet-200' : 'border-slate-700 text-slate-400'}`}>
                {m === 'copy' ? 'Copy (keep it here too)' : 'Move (take it from here)'}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select value={sendTo.society} onChange={e => setSendTo(v => ({ ...v, society: e.target.value, folder: '' }))} required className={inputCls}>
              <option value="">To which Society?</option>
              {targets.societies.map(x => <option key={x.id} value={x.id}>{x.current ? `This Society (${x.name})` : x.name}</option>)}
            </select>
            <select value={sendTo.folder} onChange={e => setSendTo(v => ({ ...v, folder: e.target.value }))} disabled={!sendTo.society} className={inputCls}>
              <option value="">Documents (top level)</option>
              {targets.folders.filter(x => String(x.customer_id) === sendTo.society && !(sending.type === 'folder' && x.id === sending.id)).map(x => <option key={x.id} value={x.id}>{x.full_path}</option>)}
            </select>
          </div>
          <p className="text-[11px] text-slate-500">Copies start with fresh open and download counts; moved items keep theirs.</p>
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !sendTo.society} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50">
              {busy ? 'Working…' : sendTo.mode === 'copy' ? 'Copy' : 'Move'}
            </button>
            <button type="button" onClick={() => setSending(null)} className="px-2 text-sm text-slate-500 hover:text-slate-300">Cancel</button>
          </div>
        </form>
      )}

      {/* Add panels */}
      {panel === 'upload' && (
        <form onSubmit={upload} className="rounded-2xl border border-slate-800 bg-dr-card p-4 space-y-3">
          <input ref={fileRef} type="file" onChange={e => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !form.title) setForm(v => ({ ...v, title: f.name })); }}
            className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-sm file:text-slate-100" />
          {file && file.size > data.maxBytes && (
            <p className="text-xs text-amber-300">This file is {bytes(file.size)}; the limit is {data.maxLabel}. Store it elsewhere and <button type="button" onClick={() => setPanel('link')} className="underline">add a link</button> instead.</p>
          )}
          <input value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} maxLength={200} placeholder="Title" className={inputCls} />
          <textarea value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} rows={2} maxLength={2000} placeholder="Description (optional)" className={inputCls} />
          <p className="text-[11px] text-slate-500">
            Up to {data.maxLabel}. {hereRoot ? 'This folder is sealed: the file is encrypted in your browser before it’s uploaded.' : 'For sensitive documents, a Society Admin can seal the folder: files are then encrypted in members’ browsers.'}
          </p>
          {progress != null && (
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} /></div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !file || file.size > data.maxBytes} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
              {busy ? `Uploading${progress != null ? ` ${progress}%` : '…'}` : 'Upload'}
            </button>
            <button type="button" onClick={reset} className="text-sm text-slate-500 hover:text-slate-300 px-2">Cancel</button>
          </div>
        </form>
      )}
      {panel === 'link' && (
        <form onSubmit={addLink} className="rounded-2xl border border-slate-800 bg-dr-card p-4 space-y-3">
          <input value={form.url} onChange={e => setForm(v => ({ ...v, url: e.target.value }))} type="url" required placeholder="https://…" className={inputCls} autoFocus />
          <input value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} maxLength={200} placeholder="Title (optional)" className={inputCls} />
          <textarea value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} rows={2} maxLength={2000} placeholder="Description (optional)" className={inputCls} />
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">{busy ? 'Adding…' : 'Add link'}</button>
            <button type="button" onClick={reset} className="text-sm text-slate-500 hover:text-slate-300 px-2">Cancel</button>
          </div>
        </form>
      )}
      {panel === 'folder' && (
        <form onSubmit={addFolder} className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-dr-card p-4">
          <input value={form.folderName} onChange={e => setForm(v => ({ ...v, folderName: e.target.value }))} maxLength={120} required autoFocus
            placeholder={data.path.length ? `New folder inside ${data.path[data.path.length - 1].name}` : 'New folder name'} className={`${inputCls} flex-1 min-w-[12rem]`} />
          {data.canSeal && !hereRoot && (
            <label className="flex w-full items-start gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={sealIt} onChange={e => setSealIt(e.target.checked)} className="mt-0.5 accent-emerald-500" />
              <span><span className="font-semibold text-slate-100">🔐 Seal this folder</span>: {SEALED_FOLDER}</span>
            </label>
          )}
          <button type="submit" disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">Create folder</button>
          <button type="button" onClick={reset} className="text-sm text-slate-500 hover:text-slate-300 px-2">Cancel</button>
        </form>
      )}

      {/* Listing */}
      {data.folders.length === 0 && sorted.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-dr-card p-10 text-center text-sm text-slate-500">
          {data.path.length ? 'This folder is empty.' : 'No documents yet.'}
          {data.canPost ? ' Upload a file, add a link or write a note.' : ''}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-dr-card">
          <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_5rem_6.5rem_3.5rem_5rem_17rem] gap-3 border-b border-slate-800 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Name</span><span>Size</span><span>Added</span><span className="text-right">Opens</span><span className="text-right">Downloads</span><span />
          </div>
          <ul className="divide-y divide-slate-800/60">
            {data.folders.map(f => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/30">
                <button onClick={() => goFolder(f.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" /></svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-100">{f.seal_root && <span className="mr-1" title="Sealed: end-to-end encrypted">🔐</span>}{f.name}</span>
                    <span className="text-xs text-slate-500">{f.item_count} item{f.item_count === 1 ? '' : 's'}</span>
                  </span>
                </button>
                {data.canModerate && (
                  <span className="flex gap-3 text-xs">
                    {canSend && !f.seal_root && <button onClick={() => startSend({ type: 'folder', id: f.id, name: f.name })} className="text-violet-300 hover:text-violet-200">Move / copy</button>}
                    {data.canSeal && !f.seal_root && !hereRoot && <button onClick={() => sealFolder(f)} disabled={!!converting} className="text-emerald-300 hover:text-emerald-200">🔐 Seal</button>}
                    {(!f.seal_root || rootKeys.get(f.seal_root)?.keys.size) && <button onClick={() => renameFolder(f)} className="text-slate-400 hover:text-slate-200">Rename</button>}
                    <button onClick={() => deleteFolder(f)} className="text-rose-400 hover:text-rose-300">Delete</button>
                  </span>
                )}
              </li>
            ))}
            {sorted.map(i => (
              <li key={i.id} className="px-4 py-3 hover:bg-slate-800/30">
                {editing?.id === i.id ? (
                  <div className="space-y-2">
                    <input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} maxLength={200} className={inputCls} />
                    <textarea value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} rows={2} maxLength={2000} placeholder="Description" className={inputCls} />
                    {i.protection === 'sealed' ? <p className="text-[11px] text-slate-500">Sealed documents stay in their sealed folder.</p> : (
                      <select value={editing.folderId} onChange={e => setEditing({ ...editing, folderId: e.target.value })} className={inputCls}>
                        <option value="root">Documents (top level)</option>
                        {allFolders.filter(f => !(f as { sealed?: boolean }).sealed).map(f => <option key={f.id} value={f.id}>{f.full_path}</option>)}
                      </select>
                    )}
                    <div className="flex gap-2 text-xs">
                      <button onClick={saveEdit} className="rounded bg-blue-600 px-3 py-1 font-semibold text-white hover:bg-blue-500">Save</button>
                      <button onClick={() => setEditing(null)} className="text-slate-500 hover:text-slate-300">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="sm:grid sm:grid-cols-[minmax(0,1fr)_5rem_6.5rem_3.5rem_5rem_17rem] sm:items-center sm:gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <TypeIcon item={i} />
                      <div className="min-w-0" title={i.description || undefined}>
                        <a href={openHref(i)} target="_blank" rel="noopener noreferrer"
                          onClick={e => {
                            // Notes open in a pop-up here (Ctrl/middle clicks open the page in a new tab)
                            if (i.kind === 'note') {
                              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                              e.preventDefault(); void openNote(i.id); return;
                            }
                            // Sealed: opened here (a file in the viewer, a link at its real address)
                            if (i.protection === 'sealed') {
                              e.preventDefault();
                              if (i.kind === 'file') void viewSealed(i);
                              else if (i.url?.startsWith('http')) window.open(i.url, '_blank', 'noopener,noreferrer');
                              return;
                            }
                            // Files open in the viewer; links (and Ctrl/middle clicks) open in a new tab
                            if (i.kind !== 'file' || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                            e.preventDefault(); setViewing(i);
                          }}
                          className="block truncate text-sm font-medium text-slate-100 hover:text-blue-300">{i.protection === 'sealed' && <span className="mr-1" title="Sealed: end-to-end encrypted">🔐</span>}{i.title}</a>
                        <p className="truncate text-xs text-slate-500">
                          {i.kind === 'link' ? (i.url?.startsWith('http') ? new URL(i.url).hostname : '') : i.kind === 'note' ? 'Note' : i.file_name}
                          {i.uploader ? ` · @${i.uploader}` : ''}
                          {i.description ? ` · ${i.description}` : ''}
                        </p>
                      </div>
                    </div>
                    {/* On phones these show as a compact line under the name */}
                    <span className="hidden sm:block text-xs text-slate-400">{i.kind === 'file' ? bytes(i.size_bytes) : i.kind === 'note' ? 'Note' : 'Link'}</span>
                    <span className="hidden sm:block text-xs text-slate-400">{day(i.created_at)}</span>
                    <span className="hidden sm:block text-right text-xs text-slate-300 tabular-nums">{i.open_count}</span>
                    <span className="hidden sm:block text-right text-xs text-slate-300 tabular-nums">{i.kind === 'file' ? i.download_count : '—'}</span>
                    <p className="sm:hidden mt-1 pl-12 text-[11px] text-slate-500">
                      {i.kind === 'file' ? `${bytes(i.size_bytes)} · ` : ''}{day(i.created_at)} · {i.open_count} opens{i.kind === 'file' ? ` · ${i.download_count} downloads` : ''}
                    </p>
                    <span className="mt-1 flex justify-end gap-3 pl-12 text-xs sm:mt-0 sm:pl-0">
                      {i.kind === 'file' && i.protection === 'sealed' && (
                        <button onClick={() => downloadSealed(i)} className="text-blue-400 hover:text-blue-300">Download</button>
                      )}
                      {i.kind === 'file' && i.protection !== 'sealed' && (
                        <a href={`${base}/documents/${i.id}/file?download=1`} className="text-blue-400 hover:text-blue-300"
                          title={INLINE.has(i.mime_type ?? '') ? 'Download' : 'Download (opens as a download)'}>Download</a>
                      )}
                      <button onClick={() => setSharing(i)} className="text-emerald-300 hover:text-emerald-200"
                        title={shareOutside(i) ? 'Reference it in a note, event or discussion, or make a link for people outside this Society' : 'Reference it in a note, event or discussion'}>Share</button>
                      {canSend && !hereRoot && i.protection !== 'sealed' && <button onClick={() => startSend({ type: 'doc', id: i.id, name: i.title })} className="text-violet-300 hover:text-violet-200">Move / copy</button>}
                      {canEdit(i) && canWriteHere && <button onClick={() => (i.kind === 'note' ? void editNote(i.id) : startEdit(i))} className="text-slate-400 hover:text-slate-200">Edit</button>}
                      {canDelete(i) && <button onClick={() => remove(i)} className="text-rose-400 hover:text-rose-300">Delete</button>}
                      {i.uploaded_by !== data.me && (
                        <ReportButton kind="document" id={i.id} what={i.kind === 'note' ? 'this note' : 'this document'} sealed={i.protection === 'sealed'}
                          shown={() => [i.title, i.description, i.kind === 'file' ? i.file_name : i.url].filter(Boolean).join('\n')} />
                      )}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sharing && <ShareDialog base={base} society={societyId} outside={shareOutside(sharing)} doc={sharing} plainBytes={() => plainBytes(sharing)} onClose={() => setSharing(null)} />}

      {!data.canPost && (
        <p className="text-xs text-slate-500">
          <Link href="/login" className="text-blue-400 hover:underline">Log in</Link> and join this Society to add documents.
        </p>
      )}
    </div>
  );
}
