'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

export default function NewDebatePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [subjectArea, setSubjectArea] = useState('');
  const [imageFile,   setImageFile]   = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error,       setError]       = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login?next=/dashboard/new-debate');
    if (!loading && user && user.tier !== 'moderator' && !user.isSysAdmin) {
      router.push('/dashboard');
    }
  }, [loading, user, router]);

  function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    } else {
      setImagePreview(null);
    }
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!title.trim())      { setError('Resolution title is required'); return; }
    if (!subjectArea)       { setError('Please select a topic'); return; }
    if (title.length > TITLE_MAX) { setError('Title is too long'); return; }

    setSubmitting(true);
    try {
      // Step 1 — create the debate record
      const res = await fetch('/api/debates', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title: title.trim(), description: description.trim() || undefined, subjectArea }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create debate'); return; }

      const debateId = data.id;

      // Step 2 — upload image if provided
      if (imageFile) {
        const form = new FormData();
        form.append('image', imageFile);
        const imgRes = await fetch(`/api/debates/${debateId}/image`, { method: 'POST', body: form });
        if (!imgRes.ok) {
          const imgData = await imgRes.json();
          setError(`Debate created but image failed: ${imgData.error}`);
          router.push(`/debates/${debateId}`);
          return;
        }
      }

      router.push(`/debates/${debateId}`);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="px-8 py-10">
      <div className="mx-auto max-w-2xl">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-6">
          <Link href="/dashboard" className="hover:text-slate-300 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-slate-300">New debate</span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">Create new debate</h1>
          <p className="text-sm text-slate-500 mt-1">The resolution will be published to the Public Forum.</p>
        </div>

        <form onSubmit={submit} className="space-y-5">

          {/* Resolution title */}
          <div className="card-dr p-5">
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
              Resolution <span className="text-red-400">*</span>
            </label>
            <textarea
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="This house believes that…"
              rows={3}
              maxLength={TITLE_MAX + 10}
              className="w-full rounded-lg border border-slate-700 bg-dr-surface px-3 py-2.5 text-base text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
            <p className={`mt-1 text-right text-xs ${title.length > TITLE_MAX ? 'text-red-400' : 'text-slate-600'}`}>
              {title.length}/{TITLE_MAX}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              State the resolution clearly. Debaters will argue for or against this exact wording.
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
              placeholder="Provide context, background reading, or framing for this debate…"
              rows={4}
              maxLength={DESC_MAX + 10}
              className="w-full rounded-lg border border-slate-700 bg-dr-surface px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
            <p className={`mt-1 text-right text-xs ${description.length > DESC_MAX ? 'text-red-400' : 'text-slate-600'}`}>
              {description.length}/{DESC_MAX}
            </p>
          </div>

          {/* Image upload */}
          <div className="card-dr p-5">
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
              Image <span className="text-slate-600">(optional — JPEG, PNG or WebP, max 5 MB)</span>
            </label>
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full max-h-56 object-cover rounded-lg border border-slate-700"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-slate-200 hover:bg-black/80 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-700 px-6 py-10 text-slate-500 transition-colors hover:border-blue-600/50 hover:text-blue-400"
              >
                <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
                <span className="text-sm">Click to upload image</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onImageChange}
              className="hidden"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create debate'}
            </button>
            <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
              Cancel
            </Link>
          </div>

        </form>
      </div>
    </div>
  );
}
