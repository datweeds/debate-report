'use client';

import { useRef, useState } from 'react';

// Society dashboard image: upload, replace, remove (saved immediately).
export default function SocietyImageField({ endpoint, value, onChange }: {
  endpoint: string;   // POST uploads, DELETE removes
  value: string | null;
  onChange: (path: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true); setErr('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      const r = await fetch(endpoint, { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok) { setErr(d.error ?? 'Upload failed'); return; }
      onChange(d.imagePath);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function remove() {
    setBusy(true); setErr('');
    try {
      const r = await fetch(endpoint, { method: 'DELETE' });
      if (!r.ok) { setErr('Remove failed'); return; }
      onChange(null);
    } finally { setBusy(false); }
  }

  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">Dashboard image</label>
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="mb-2 max-h-48 w-full rounded-lg border border-slate-700 object-cover" />
      )}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 hover:text-slate-100 disabled:opacity-40 transition-colors"
        >
          {busy ? 'Working…' : value ? 'Replace image' : 'Upload image'}
        </button>
        {value && (
          <button type="button" onClick={remove} disabled={busy} className="text-xs text-rose-500 hover:text-rose-400 disabled:opacity-40 transition-colors">
            Remove
          </button>
        )}
        <span className="text-[11px] text-slate-600">JPEG, PNG or WebP, up to 5 MB</span>
      </div>
      {err && <p className="text-xs text-red-400 mt-1">{err}</p>}
    </div>
  );
}
