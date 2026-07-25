import { notFound } from 'next/navigation';
import Link from 'next/link';
import pool from '@/lib/db';

const SUBJECT_LABELS: Record<string, string> = {
  culture:     'Culture, Identity & Social Issues',
  economics:   'Economics & Markets',
  education:   'Education & Knowledge',
  environment: 'Environment & Energy',
  future:      'Future & Existential Questions',
  health:      'Health, Medicine & Bioethics',
  history:     'History & Historical Interpretation',
  law:         'Law, Rights & Justice',
  media:       'Media, Information & Epistemology',
  philosophy:  'Philosophy, Ethics & Religion',
  politics:    'Politics, Policy & Governance',
  science:     'Science & Technology',
};

const SUBJECT_COLOURS: Record<string, string> = {
  culture:     'bg-pink-500/10 text-pink-300 border-pink-800/30',
  economics:   'bg-emerald-500/10 text-emerald-300 border-emerald-800/30',
  education:   'bg-sky-500/10 text-sky-300 border-sky-800/30',
  environment: 'bg-green-500/10 text-green-300 border-green-800/30',
  future:      'bg-violet-500/10 text-violet-300 border-violet-800/30',
  health:      'bg-rose-500/10 text-rose-300 border-rose-800/30',
  history:     'bg-amber-500/10 text-amber-300 border-amber-800/30',
  law:         'bg-slate-500/10 text-slate-300 border-slate-600/30',
  media:       'bg-cyan-500/10 text-cyan-300 border-cyan-800/30',
  philosophy:  'bg-indigo-500/10 text-indigo-300 border-indigo-800/30',
  politics:    'bg-blue-500/10 text-blue-300 border-blue-800/30',
  science:     'bg-teal-500/10 text-teal-300 border-teal-800/30',
};

type Debate = {
  id: string;
  stat_title: string;
  stat_description: string | null;
  subject_area: string;
  image_path: string | null;
  forum_visibility: string;
  created_at: string;
  creator_handle: string | null;
};

async function getDebate(id: string): Promise<Debate | null> {
  const { rows } = await pool.query<Debate>(
    `SELECT s.id, s.stat_title, s.stat_description, s.subject_area,
            s.image_path, s.forum_visibility, s.created_at,
            u.user_handle AS creator_handle
     FROM   statements s
     LEFT   JOIN users u ON u.id = s.created_by
     WHERE  s.id = $1 AND s.stat_type = 'resolution'`,
    [id]
  );
  return rows[0] ?? null;
}

export default async function DebatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const debate = await getDebate(id);

  if (!debate) notFound();

  const subjectLabel  = SUBJECT_LABELS[debate.subject_area]  ?? debate.subject_area;
  const subjectColour = SUBJECT_COLOURS[debate.subject_area] ?? 'bg-slate-500/10 text-slate-300 border-slate-600/30';

  const createdDate = new Date(debate.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-dr-base">

      {/* Hero image */}
      {debate.image_path && (
        <div className="relative h-64 sm:h-80 overflow-hidden">
          <img
            src={debate.image_path}
            alt=""
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-dr-base/40 to-dr-base" />
        </div>
      )}

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-6">
          <Link href="/" className="hover:text-slate-300 transition-colors">Home</Link>
          <span>/</span>
          <span className="text-slate-300">Debate</span>
        </div>

        {/* Topic badge */}
        <div className="mb-4">
          <span className={`inline-block rounded-full border px-3 py-0.5 text-xs font-semibold ${subjectColour}`}>
            {subjectLabel}
          </span>
        </div>

        {/* Resolution */}
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 leading-snug mb-6">
          {debate.stat_title}
        </h1>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-8 pb-8 border-b border-slate-800">
          <span className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            {createdDate}
          </span>
          {debate.creator_handle && (
            <span className="flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              @{debate.creator_handle}
            </span>
          )}
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            debate.forum_visibility === 'public'
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-amber-500/10 text-amber-400'
          }`}>
            {debate.forum_visibility} forum
          </span>
        </div>

        {/* Background / description */}
        {debate.stat_description && (
          <div className="card-dr p-6 mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Background</p>
            <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
              {debate.stat_description}
            </div>
          </div>
        )}

        {/* Enter Chamber */}
        <Link
          href={`/chamber?resolution=${debate.id}`}
          className="card-dr flex flex-col items-center gap-4 p-8 text-center hover:border-blue-500/40 hover:shadow-blue-500/10 transition-all group"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
            <svg className="h-7 w-7 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
            </svg>
          </div>
          <div>
            <p className="text-slate-200 text-sm font-semibold group-hover:text-white transition-colors">Enter the Debate Chamber</p>
            <p className="text-slate-500 text-xs mt-1">View arguments, evidence and the structured debate graph</p>
          </div>
          <span className="rounded-full bg-blue-600/80 px-4 py-1.5 text-xs font-semibold text-white group-hover:bg-blue-500 transition-colors">
            Open Chamber →
          </span>
        </Link>

      </div>
    </div>
  );
}
