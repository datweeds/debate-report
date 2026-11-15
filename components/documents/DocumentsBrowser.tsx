'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Folder = { id: string; name: string; item_count: number };
type Item = {
  id: string; kind: 'file' | 'link'; title: string; description: string | null; url: string | null;
  file_name: string | null; mime_type: string | null; size_bytes: number | null; created_at: string;
  open_count: number; download_count: number; uploaded_by: string | null; uploader: string | null;
};
type Data = {
  folderId: string | null; path: { id: string; name: string }[]; folders: Folder[]; items: Item[];
  me: string | null; canPost: boolean; canModerate: boolean; canTakeDown: boolean; maxBytes: number; maxLabel: string;
};

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
  const label = item.kind === 'link' ? 'LINK'
    : (item.file_name?.split('.').pop() ?? 'FILE').toUpperCase().slice(0, 4);
  const colour = item.kind === 'link' ? 'bg-sky-500/15 text-sky-300'
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
  const [editing, setEditing] = useState<{ id: string; title: string; description: string; folderId: string } | null>(null);
  const [allFolders, setAllFolders] = useState<{ id: string; full_path: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`${base}/documents${folder ? `?folder=${folder}` : ''}`);
    if (!r.ok) { setError(r.status === 404 ? 'This folder no longer exists.' : 'Could not load documents.'); return; }
    setError('');
    setData(await r.json());
  }, [base, folder]);
  useEffect(() => { load(); }, [load]);

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
  function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !data) return;
    if (file.size > data.maxBytes) { setError(`Files can be up to ${data.maxLabel}. For anything larger, add a link to where it's stored.`); return; }
    const fd = new FormData();
    fd.append('file', file); fd.append('title', form.title); fd.append('description', form.description);
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
      body: JSON.stringify({ url: form.url, title: form.title, description: form.description, folderId: data?.folderId }),
    });
    setBusy(false);
    if (!r.ok) { setError((await r.json()).error ?? 'Could not add the link'); return; }
    reset(); load();
  }

  async function addFolder(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const r = await fetch(`${base}/folders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.folderName, parentId: data?.folderId }),
    });
    setBusy(false);
    if (!r.ok) { setError((await r.json()).error ?? 'Could not create the folder'); return; }
    reset(); load();
  }

  async function renameFolder(f: Folder) {
    const name = prompt('Folder name', f.name);
    if (!name?.trim() || name === f.name) return;
    await fetch(`${base}/folders/${f.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
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
      body: JSON.stringify({ title: editing.title, description: editing.description, folderId: editing.folderId }),
    });
    if (!r.ok) { setError((await r.json()).error ?? 'Could not save'); return; }
    setEditing(null); load();
  }

  async function remove(item: Item) {
    if (!confirm(`Delete "${item.title}"?`)) return;
    await fetch(`${base}/documents/${item.id}`, { method: 'DELETE' });
    load();
  }

  if (!data) return error ? <p className="text-sm text-rose-400">{error}</p> : <div className="h-40 rounded-2xl bg-slate-800/40 animate-pulse" />;

  const openHref = (i: Item) => i.kind === 'link' ? `${base}/documents/${i.id}/open` : `${base}/documents/${i.id}/file`;
  const canEdit = (i: Item) => i.uploaded_by === data.me || data.canModerate;
  const canDelete = (i: Item) => i.uploaded_by === data.me || data.canTakeDown;

  return (
    <div className="space-y-4">
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
          {data.canModerate && (
            <button onClick={() => setPanel(panel === 'folder' ? 'none' : 'folder')} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500">+ Folder</button>
          )}
          {data.canPost && (
            <>
              <button onClick={() => setPanel(panel === 'link' ? 'none' : 'link')} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500">+ Link</button>
              <button onClick={() => setPanel(panel === 'upload' ? 'none' : 'upload')} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500">Upload</button>
            </>
          )}
        </div>
      </div>

      {error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}

      {/* Add panels */}
      {panel === 'upload' && (
        <form onSubmit={upload} className="rounded-2xl border border-slate-800 bg-[#0c1322] p-4 space-y-3">
          <input ref={fileRef} type="file" onChange={e => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !form.title) setForm(v => ({ ...v, title: f.name })); }}
            className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-sm file:text-slate-100" />
          {file && file.size > data.maxBytes && (
            <p className="text-xs text-amber-300">This file is {bytes(file.size)}; the limit is {data.maxLabel}. Store it elsewhere and <button type="button" onClick={() => setPanel('link')} className="underline">add a link</button> instead.</p>
          )}
          <input value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} maxLength={200} placeholder="Title" className={inputCls} />
          <textarea value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} rows={2} maxLength={2000} placeholder="Description (optional)" className={inputCls} />
          <p className="text-[11px] text-slate-500">
            Up to {data.maxLabel}. Files aren&apos;t encrypted on our server yet: if a document is sensitive, encrypt it before uploading and share the key separately.
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
        <form onSubmit={addLink} className="rounded-2xl border border-slate-800 bg-[#0c1322] p-4 space-y-3">
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
        <form onSubmit={addFolder} className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-[#0c1322] p-4">
          <input value={form.folderName} onChange={e => setForm(v => ({ ...v, folderName: e.target.value }))} maxLength={120} required autoFocus
            placeholder={data.path.length ? `New folder inside ${data.path[data.path.length - 1].name}` : 'New folder name'} className={`${inputCls} flex-1 min-w-[12rem]`} />
          <button type="submit" disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">Create folder</button>
          <button type="button" onClick={reset} className="text-sm text-slate-500 hover:text-slate-300 px-2">Cancel</button>
        </form>
      )}

      {/* Listing */}
      {data.folders.length === 0 && sorted.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-10 text-center text-sm text-slate-500">
          {data.path.length ? 'This folder is empty.' : 'No documents yet.'}
          {data.canPost ? ' Upload a file or add a link.' : ''}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0c1322]">
          <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_5rem_7rem_4rem_5.5rem_10rem] gap-3 border-b border-slate-800 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
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
                    <span className="block truncate text-sm font-medium text-slate-100">{f.name}</span>
                    <span className="text-xs text-slate-500">{f.item_count} item{f.item_count === 1 ? '' : 's'}</span>
                  </span>
                </button>
                {data.canModerate && (
                  <span className="flex gap-3 text-xs">
                    <button onClick={() => renameFolder(f)} className="text-slate-400 hover:text-slate-200">Rename</button>
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
                    <select value={editing.folderId} onChange={e => setEditing({ ...editing, folderId: e.target.value })} className={inputCls}>
                      <option value="root">Documents (top level)</option>
                      {allFolders.map(f => <option key={f.id} value={f.id}>{f.full_path}</option>)}
                    </select>
                    <div className="flex gap-2 text-xs">
                      <button onClick={saveEdit} className="rounded bg-blue-600 px-3 py-1 font-semibold text-white hover:bg-blue-500">Save</button>
                      <button onClick={() => setEditing(null)} className="text-slate-500 hover:text-slate-300">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="sm:grid sm:grid-cols-[minmax(0,1fr)_5rem_7rem_4rem_5.5rem_10rem] sm:items-center sm:gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <TypeIcon item={i} />
                      <div className="min-w-0">
                        <a href={openHref(i)} target="_blank" rel="noopener noreferrer"
                          className="block truncate text-sm font-medium text-slate-100 hover:text-blue-300">{i.title}</a>
                        <p className="truncate text-xs text-slate-500">
                          {i.kind === 'link' ? (i.url ? new URL(i.url).hostname : '') : i.file_name}
                          {i.uploader ? ` · @${i.uploader}` : ''}
                          {i.description ? ` · ${i.description}` : ''}
                        </p>
                      </div>
                    </div>
                    {/* On phones these show as a compact line under the name */}
                    <span className="hidden sm:block text-xs text-slate-400">{i.kind === 'file' ? bytes(i.size_bytes) : 'Link'}</span>
                    <span className="hidden sm:block text-xs text-slate-400">{day(i.created_at)}</span>
                    <span className="hidden sm:block text-right text-xs text-slate-300 tabular-nums">{i.open_count}</span>
                    <span className="hidden sm:block text-right text-xs text-slate-300 tabular-nums">{i.kind === 'file' ? i.download_count : '—'}</span>
                    <p className="sm:hidden mt-1 pl-12 text-[11px] text-slate-500">
                      {i.kind === 'file' ? `${bytes(i.size_bytes)} · ` : ''}{day(i.created_at)} · {i.open_count} opens{i.kind === 'file' ? ` · ${i.download_count} downloads` : ''}
                    </p>
                    <span className="mt-1 flex justify-end gap-3 pl-12 text-xs sm:mt-0 sm:pl-0">
                      {i.kind === 'file' && (
                        <a href={`${base}/documents/${i.id}/file?download=1`} className="text-blue-400 hover:text-blue-300"
                          title={INLINE.has(i.mime_type ?? '') ? 'Download' : 'Download (opens as a download)'}>Download</a>
                      )}
                      {canEdit(i) && <button onClick={() => startEdit(i)} className="text-slate-400 hover:text-slate-200">Edit</button>}
                      {canDelete(i) && <button onClick={() => remove(i)} className="text-rose-400 hover:text-rose-300">Delete</button>}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!data.canPost && (
        <p className="text-xs text-slate-500">
          <Link href="/login" className="text-blue-400 hover:underline">Log in</Link> and join this Society to add documents.
        </p>
      )}
    </div>
  );
}
