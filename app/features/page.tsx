import Link from 'next/link';
import type { Metadata } from 'next';
import { ClosingCta, Eyebrow, FeatureIcon, ONLY_HERE } from '@/components/home/HomeSections';
import FeatureNav from '@/components/FeatureNav';

export const metadata: Metadata = {
  title: 'Features',
  description: 'Everything a new.vote Society can do: structured debate, secret-ballot polls, news, discussions, calls, documents, events, projects and principles.',
};

type Item = { title: string; text: string };
type Group = { id: string; icon?: string; eyebrow: string; title: string; lead?: string; items: Item[] };

// Each Society tool (ids match lib/features.ts, so the toolkit tiles link here), then the platform around them
const GROUPS: Group[] = [
  { id: 'debates', icon: 'debates', eyebrow: 'Debate', title: 'Arguments you can see', items: [
    { title: 'Argument maps', text: 'Every debate drawn as a map of claims, warrants, evidence, rebuttals and impacts, for and against.' },
    { title: 'Votes on every point', text: 'Agree or disagree with each statement, and vote on the motion itself.' },
    { title: 'Evidence first', text: 'Back claims with sources, and see which points are left unsupported.' },
    { title: 'Quality checks', text: 'Rule-based and AI reviews flag weak links, repetition and fallacies, for moderators to act on.' },
    { title: 'Public, Apply or Invite', text: 'Each debate can be open to all, by request, or for invited people only.' },
    { title: 'Closing decisions', text: 'Moderators close a debate with a decision and a written rationale.' },
  ] },
  { id: 'polls', icon: 'polls', eyebrow: 'Polls', title: 'Ballots you can trust', items: [
    { title: 'Eight kinds of question', text: 'Single and multiple choice, ranking, ranked-choice (instant runoff), star ratings, yes/no, scales and word clouds.' },
    { title: 'Secret or named', text: 'In a secret poll the ballot isn’t stored with your name. It is linked to you only by a code made with a key kept outside the database (so you can change your vote), so even a copy of our database can’t tie a ballot to a voter.' },
    { title: 'Receipts and an audit log', text: 'Your receipt is a random code made in your own browser. Only a scrambled (SHA-256) form of it is stored with your ballot and listed in the poll’s audit log, so you can find your ballot in the count, but no one else can tell which ballot is yours.' },
    { title: 'Verify the count', text: 'Moderators recount every ballot from scratch and check voters, ballots and receipts agree.' },
    { title: 'Live meetings and quizzes', text: 'Open questions one at a time on a presentation screen; mark answers and score quizzes.' },
    { title: 'Access codes', text: 'Let people without an account vote once each with a one-use code.' },
  ] },
  { id: 'news', icon: 'news', eyebrow: 'News', title: 'A magazine for your topics', items: [
    { title: 'Many sources', text: 'Mainstream and alternative sources, gathered around the Society’s topics.' },
    { title: 'Organised by topic', text: 'Stories grouped under headings, with the most important leading.' },
    { title: 'Under the Society’s control', text: 'Switch the news on or off and keep AI spending within a daily limit.' },
  ] },
  { id: 'discussions', icon: 'discussions', eyebrow: 'Discussions', title: 'Conversation for members', items: [
    { title: 'Threads', text: 'Members-only threads, with reactions, pinning and locking.' },
    { title: 'Report a message', text: 'Members flag a message to the moderators in one click.' },
    { title: 'Encrypted when private', text: 'In a private Society every message is stored encrypted.' },
  ] },
  { id: 'meet', icon: 'meet', eyebrow: 'Meet', title: 'Talk face to face', items: [
    { title: 'Audio and video rooms', text: 'Rooms for meetings and debates, inside the Society.' },
    { title: 'End-to-end encrypted rooms', text: 'With a passphrase only members know; never recorded.' },
    { title: 'Moderation', text: 'Moderators mute, remove or ban, and end rooms.' },
  ] },
  { id: 'documents', icon: 'documents', eyebrow: 'Documents', title: 'One shared library', items: [
    { title: 'Files and links', text: 'Upload files or save links, organised in folders.' },
    { title: 'Move or copy between Societies', text: 'Moderators of more than one Society can share material between them.' },
    { title: 'Encrypted when private', text: 'Files, titles and folder names alike.' },
  ] },
  { id: 'events', icon: 'events', eyebrow: 'Events', title: 'The Society’s calendar', items: [
    { title: 'Month and day views', text: 'With project deadlines shown alongside events.' },
    { title: 'Add to your calendar', text: 'Download any event for Apple, Google or Outlook.' },
  ] },
  { id: 'projects', icon: 'projects', eyebrow: 'Projects', title: 'Get things done together', items: [
    { title: 'Tasks and sub-tasks', text: 'With dates, owners and a Gantt view.' },
    { title: 'Status reports', text: 'Members report progress on the tasks they’re allocated.' },
    { title: 'Risks and issues', text: 'A RAID log of risks, issues, dependencies and assumptions.' },
  ] },
  { id: 'principles', icon: 'principles', eyebrow: 'Principles', title: 'The rules you run by', items: [
    { title: 'Versions', text: 'Publish the Society’s principles in versions, with notes on what changed.' },
    { title: 'Start from a library', text: 'Copy from ready-made sets on debating and human rights.' },
    { title: 'Question them', text: 'Members request reviews, discuss a principle, or put it to a debate.' },
  ] },
  { id: 'privacy', eyebrow: 'Privacy and security', title: 'Private means private', items: [
    { title: 'Encryption at rest', text: 'Private Societies’ content is stored encrypted with each Society’s own key. It is decrypted on our server to show to members, so it is not end-to-end encrypted (Meet rooms can be).' },
    { title: 'A master key kept offline', text: 'The key that unlocks Society keys can be kept off our servers entirely.' },
    { title: 'No routine admin access', text: 'Emergency access only, time-limited, with a reason, logged and shown to the Society.' },
    { title: 'Passkeys, not passwords', text: 'Sign in with a passkey; no personal details needed to join.' },
    { title: 'No ads or tracking', text: 'Only the cookies the site needs to work.' },
    { title: 'Deleted means gone', text: 'Delete a Society and its key goes too, so its encrypted content can no longer be read.' },
  ] },
  { id: 'moderation', eyebrow: 'Safety and moderation', title: 'Healthy debate by design', items: [
    { title: 'Content scanning', text: 'New content is checked automatically for abuse and flagged for moderators to review.' },
    { title: 'One review queue', text: 'Society moderators and the platform team see the same alerts, so action taken is visible to both.' },
    { title: 'Appeals', text: 'Authors can appeal a moderation decision.' },
    { title: 'Members report', text: 'Anyone can flag a statement or message, with a reason.' },
  ] },
  { id: 'running', eyebrow: 'Running a Society', title: 'Make it yours', items: [
    { title: 'Feature switches', text: 'Switch any tool off, or back on, for your Society.' },
    { title: 'Members and moderators', text: 'Invite links, join requests and roles.' },
    { title: 'Your choice of AI', text: 'new.vote’s AI, your own provider and key, or none, with spending you can see.' },
    { title: 'Activity at a glance', text: 'Totals and recent activity for every part of the Society.' },
  ] },
  { id: 'developers', eyebrow: 'For developers', title: 'Connect your own tools', items: [
    { title: 'Debate API', text: 'Read debates and post statements from your own applications, with a token.' },
    { title: 'Guest review links', text: 'Time-limited links that let a reviewer see chosen debates without an account.' },
  ] },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-dr-base">
      <section className="mx-auto flex max-w-5xl flex-col gap-5 px-4 pb-10 pt-14 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 sm:text-5xl">Everything a Society can do</h1>
        <p className="max-w-2xl text-lg leading-relaxed text-slate-400">
          Every Society starts with all of these tools. Its admins switch off what they don’t need, so it can be as simple or as full-featured as its members want.
          {' '}<Link href="/guides" className="text-blue-400 hover:text-blue-300">Full details in the Guides →</Link>
        </p>
      </section>

      <FeatureNav sections={[{ id: 'only', label: 'Only in new.vote', accent: true }, ...GROUPS.map(g => ({ id: g.id, label: g.eyebrow }))]} />

      <section id="only" aria-labelledby="only-h" className="mx-auto max-w-5xl scroll-mt-36 px-4 py-14 sm:px-6">
        <div className="flex flex-col gap-6 rounded-2xl border-2 border-amber-400/70 bg-dr-card p-6 sm:p-10">
          <div className="flex flex-col gap-2">
            <Eyebrow accent>Only in new.vote</Eyebrow>
            <h2 id="only-h" className="text-2xl font-bold text-slate-100 sm:text-3xl">What you won’t find elsewhere</h2>
          </div>
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {ONLY_HERE.map(f => (
              <div key={f.title} className="flex flex-col gap-1.5">
                <h3 className="text-base font-semibold text-slate-100">{f.title}</h3>
                <p className="text-sm leading-relaxed text-slate-400">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {GROUPS.map((g, i) => (
        <section key={g.id} id={g.id} aria-labelledby={`${g.id}-h`}
          className={`scroll-mt-32 ${i % 2 === 0 ? 'border-y border-blue-900/20 bg-dr-surface' : ''}`}>
          <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-12 sm:px-6">
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-blue-400">
                {g.icon && <FeatureIcon k={g.icon} className="h-4 w-4" />}{g.eyebrow}
              </span>
              <h2 id={`${g.id}-h`} className="text-2xl font-bold text-slate-100">{g.title}</h2>
            </div>
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map(it => (
                <div key={it.title} className="flex flex-col gap-1">
                  <h3 className="text-sm font-semibold text-slate-100">{it.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{it.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      <p className="mx-auto max-w-5xl px-4 py-8 text-center text-sm text-slate-500 sm:px-6">
        For full details, read the <Link href="/guides" className="text-blue-400 hover:text-blue-300">Guides</Link>. Missing something? <Link href="/support" className="text-blue-400 hover:text-blue-300">Tell us →</Link>
      </p>
      <ClosingCta />
    </div>
  );
}
