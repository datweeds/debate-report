'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

const SUBJECT_AREAS = [
  { value: 'culture',     label: 'Culture, Identity & Social Issues' },
  { value: 'economics',   label: 'Economics & Markets' },
  { value: 'education',   label: 'Education & Knowledge' },
  { value: 'environment', label: 'Environment & Energy' },
  { value: 'future',      label: 'Future & Existential Questions' },
  { value: 'health',      label: 'Health, Medicine & Bioethics' },
  { value: 'history',     label: 'History & Historical Interpretation' },
  { value: 'law',         label: 'Law, Rights & Justice' },
  { value: 'media',       label: 'Media, Information & Epistemology' },
  { value: 'philosophy',  label: 'Philosophy, Ethics & Religion' },
  { value: 'politics',    label: 'Politics, Policy & Governance' },
  { value: 'science',     label: 'Science & Technology' },
];

const TITLE_MAX = 500;
const DESC_MAX  = 2000;

type Debate = {
  id: string;
  stat_title: string;
  stat_description: string | null;
  subject_area: string;
  image_path: string | null;
  forum_visibility: string;
  child_count: number;
};

export default function EditDebatePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [debate,      setDebate]      = useState<Debate | null>(null);
  const [fetching,    setFetching]    = useState(true);
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [subjectArea, setSubjectArea] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [removeImage,  setRemoveImage]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [saved,       setSaved]       = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) router.push(`/login?next=/dashboard/debates/${id}/edit`);
    if (!loading && user && user.tier !== 'moderator' && !user.isSysAdmin) router.push('/dashboard');
  }, [loading, user, router, id]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/debates/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: Debate) => {
        setDebate(d);
        setTitle(d.stat_title);
        setDescription(d.stat_description ?? '');
        setSubjectArea(d.subject_area);
        setImagePreview(d.image_path);
      })
      .catch(() => setError('Could not load debate.'))
      .finally(() => setFetching(false));
  }, [id]);

  function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setNewImageFile(file);
    setRemoveImage(false);
    if (file) setImagePreview(URL.createObjectURL(file));
    else setImagePreview(debate?.image_path ?? null);
  }

  function clearImage() {
    setNewImageFile(null);
    setRemoveImage(true);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);

    if (!title.trim())  { setError('Resolution title is required'); return; }
    if (!subjectArea)   { setError('Please select a topic'); return; }
    if (title.length > TITLE_MAX) { setError('Title is too long'); return; }

    setSaving(true);
    try {
      // 1. Save text fields
      const res = await fetch(`/api/debates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || '',
          subjectArea,
          removeImage,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Save failed'); return; }

      // 2. Upload new image if chosen
      if (newImageFile) {
        const form = new FormData();
        form.append('image', newImageFile);
        const imgRes = await fetch(`/api/debates/${id}/image`, { method: 'POST', body: form });
        if (!imgRes.ok) {
          const imgData = await imgRes.json();
          setError(`Fields saved but image failed: ${imgData.error}`);
          return;
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user || fetching) return null;

  return (
    <div className="min-h-screen bg-dr-base px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-6">
          <Link href="/dashboard" className="hover:text-slate-300 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/dashboard/debates" className="hover:text-slate-300 transition-colors">Debates</Link>
          <span>/</span>
          <span className="text-slate-300">Edit</span>
        </div>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Edit debate</h1>
            {debate && (
              <Link href={`/debates/${debate.id}`} target="_blank"
                className="text-xs text-blue-400 hover:underline mt-1 inline-block">
                View live →
              </Link>
            )}
          </div>
          {debate && debate.child_count > 0 && (
            <span className="rounded-lg bg-amber-500/10 border border-amber-800/30 px-3 py-1.5 text-xs text-amber-300">
              {debate.child_count} statement{debate.child_count !== 1 ? 's' : ''} attached
            </span>
          )}
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        {saved && (
          <div className="mb-5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            Saved successfully.
          </div>
        )}

        <form onSubmit={save} className="space-y-5">

          {/* Resolution title */}
          <div className="card-dr p-5">
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
              Resolution <span className="text-red-400">*</span>
            </label>
            <textarea
              value={title}
              onChange={e => setTitle(e.target.value)}
              rows={3}
              maxLength={TITLE_MAX + 10}
              className="w-full rounded-lg border border-slate-700 bg-dr-surface px-3 py-2.5 text-base text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
            <p className={`mt-1 text-right text-xs ${title.length > TITLE_MAX ? 'text-red-400' : 'text-slate-600'}`}>
              {title.length}/{TITLE_MAX}
            </p>
          </div>

          {/* Topic */}
          <div className="card-dr p-5">
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
              Topic <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SUBJECT_AREAS.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSubjectArea(s.value)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium text-left transition-colors ${
                    subjectArea === s.value
                      ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                      : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="card-dr p-5">
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
              Background <span className="text-slate-600">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              maxLength={DESC_MAX + 10}
              className="w-full rounded-lg border border-slate-700 bg-dr-surface px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
            <p className={`mt-1 text-right text-xs ${description.length > DESC_MAX ? 'text-red-400' : 'text-slate-600'}`}>
              {description.length}/{DESC_MAX}
            </p>
          </div>

          {/* Image */}
          <div className="card-dr p-5">
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
              Image <span className="text-slate-600">(optional)</span>
            </label>
            {imagePreview && !removeImage ? (
              <div className="relative">
                <img src={imagePreview} alt="Preview"
                  className="w-full max-h-56 object-cover rounded-lg border border-slate-700" />
                <div className="absolute top-2 right-2 flex gap-2">
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="rounded-full bg-black/60 px-3 py-1.5 text-xs text-slate-200 hover:bg-black/80 transition-colors">
                    Replace
                  </button>
                  <button type="button" onClick={clearImage}
                    className="rounded-full bg-black/60 p-1.5 text-slate-200 hover:bg-red-900/60 transition-colors">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-700 px-6 py-10 text-slate-500 transition-colors hover:border-blue-600/50 hover:text-blue-400">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
                <span className="text-sm">{removeImage ? 'Image removed — click to add one' : 'Click to upload image'}</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
              onChange={onImageChange} className="hidden" />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <Link href="/dashboard/debates" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
              Back to list
            </Link>
          </div>

        </form>
      </div>
    </div>
  );
}
