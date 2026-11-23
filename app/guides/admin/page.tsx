import Link from 'next/link';
import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import GuideShell, { Item, List, LoginForGuide, Note, P, Steps, Sub, type GuideSection } from '@/components/guides/GuideShell';

export const metadata: Metadata = { title: 'Admin guide', robots: { index: false } };

const a = (href: string, text: string) => <Link href={href} className="text-blue-400 underline underline-offset-2 hover:text-blue-300">{text}</Link>;

const SECTIONS: GuideSection[] = [
  { id: 'purpose', title: 'What new.vote is for', short: 'Purpose', body: <>
    <P>
      new.vote supports communities online and helps them grow: places where people debate with evidence, make decisions
      together, and organise what happens next. Each community is a <strong className="text-slate-100">Society</strong>,
      with its own members, its own Society Admins and its own rules.
    </P>
    <P>
      As a Society Admin, you shape the space: who can join, which tools are switched on, the
      principles it runs by, and how its debates and decisions are conducted. new.vote provides the platform, security and
      safety tools; your Society decides how it works.
    </P>
    <Note>A Society can have several Society Admins. In its debates, they are the moderators.</Note>
    <P>
      Every Society Admin follows the <a href="/guides/society-admin-procedure" className="text-blue-400 hover:underline">Society Admin
      procedure</a>: a short list of what to check each week, month and year. Running a Society for young people? Read{' '}
      <a href="/guides/youth-groups" className="text-blue-400 hover:underline">Running a youth group</a> too.
    </P>
  </> },

  { id: 'start', title: 'Getting started', short: 'Start', body: <>
    <Steps items={[
      <>Create a free account: just a username and a passkey on your device. Keep the recovery code you’re shown.</>,
      <>Open {a('/dashboard/societies', 'Manage Societies')} and choose <strong className="text-slate-100">+ New Society</strong>. No approval is needed.</>,
      <>It uses your plan: Huddle is free for up to 3 Societies. Move to Team or Network from {a('/dashboard/billing', 'Plans & billing')} for more Societies, room, longer calls or formal ballots (see {a('/pricing', 'Pricing')}).</>,
      <>Fill in the details: name, a short line for the top of its pages, a description, a contact email (never shown publicly) and an image.</>,
      <>Choose who can see it, switch on the tools you want, invite your first members, and write its principles.</>,
    ]} />
    <P>Everything below is managed from {a('/dashboard/societies', 'Manage Societies')}, or from the <em>Manage society →</em> link on your Society’s pages.</P>
  </> },

  { id: 'visibility', title: 'Who can see your Society', short: 'Visibility', body: <>
    <List items={[
      <Item name="Public:">anyone can read it, and anyone with an account can join straight away.</Item>,
      <Item name="Apply:">listed for everyone to find; people ask to join and you approve them.</Item>,
      <Item name="Invite:">hidden from everyone except members; people join through invite links you send.</Item>,
    ]} />
    <P>
      Apply and Invite Societies are <strong className="text-slate-100">private</strong>: their debates, polls,
      discussions, documents, events, projects and principles are stored encrypted with the Society’s own key. Switching
      between public and private re-encrypts everything automatically.
    </P>
    <P>Each debate also has its own visibility (Public, Apply or Invite), so a public Society can hold private debates. A debate in a private Society can’t be made Public.</P>
  </> },

  { id: 'features', title: 'Choosing your tools', short: 'Tools', body: <>
    <P>
      Every Society starts with every tool switched on. In <strong className="text-slate-100">Manage Societies → Features</strong>,
      switch off whatever your members don’t need: it disappears from the menus for everyone. Nothing is deleted; switch it
      back on and it all returns.
    </P>
    <List items={[
      <Item name="Debate:">structured debates, mapped and voted on point by point.</Item>,
      <Item name="Polls:">secret or named ballots, ranked-choice votes, ratings and quizzes.</Item>,
      <Item name="News:">a regular magazine of stories on your Society’s topics.</Item>,
      <Item name="Discussions:">members-only threads.</Item>,
      <Item name="Meet:">audio and video rooms, optionally end-to-end encrypted.</Item>,
      <Item name="Documents:">shared files and links in folders.</Item>,
      <Item name="Events:">the Society’s calendar.</Item>,
      <Item name="Projects:">tasks, status reports and risk logs.</Item>,
      <Item name="Principles:">the rules and aspirations you run by, in versions.</Item>,
    ]} />
  </> },

  { id: 'members', title: 'Members and Society Admins', short: 'Members', body: <>
    <List items={[
      <Item name="Invite links:">make a link (with a label and an expiry if you like), share it, and revoke it when you’re done. Anyone who opens it can join.</Item>,
      <Item name="Requests to join:">for an Apply Society, approve or decline each request.</Item>,
      <Item name="Society Admins:">make any member a co-admin, or remove the role. Share the load: a Society should never depend on one person.</Item>,
      <Item name="Removing members:">remove anyone who no longer belongs; their past contributions stay.</Item>,
    ]} />
  </> },

  { id: 'running', title: 'Running each tool', short: 'Each tool', body: <>
    <Sub title="Debate">
      <List items={[
        <>Start a debate from <strong className="text-slate-100">New Debate</strong> in the menu: a clear, arguable motion, a topic and a short description.</>,
        <>Set its visibility; review <strong className="text-slate-100">Join Requests</strong> and send <strong className="text-slate-100">Invitations</strong> for Apply and Invite debates.</>,
        <>Run a <strong className="text-slate-100">Debate Quality</strong> report to find weak links, repetition and possible fallacies; dismiss findings that don’t apply.</>,
        <>Close a debate with a decision (for, against or a draw) and a written rationale.</>,
        <>Move or copy a debate to another Society you moderate, with or without its votes and chat.</>,
      ]} />
    </Sub>
    <Sub title="Polls">
      <List items={[
        <>Build a poll from the Polls tab: questions of eight kinds, images, comments and quiz answers. Drafts can be edited; once voting opens, questions are fixed.</>,
        <>Choose a <em>secret</em> ballot (no one can tie a ballot to a voter) or a <em>named</em> one (Society Admins see who chose what), whether voters may change their vote, and who sees results and when.</>,
        <>For a live meeting, open questions one at a time and show results on the <em>Present live</em> screen.</>,
        <>Track turnout, make one-use access codes for people without an account, download a CSV, and press <strong className="text-slate-100">Verify</strong> to recount every ballot and check the numbers agree.</>,
      ]} />
    </Sub>
    <Sub title="News">
      <P>In the News tab’s settings, switch it on, give it a title, choose how often editions appear, add places, and set up sections with search phrases (and words that must or mustn’t appear). Preview the results before saving, or publish an edition now.</P>
    </Sub>
    <Sub title="Discussions, Meet, Documents and Events">
      <List items={[
        <>Discussions: pin, lock or remove threads and posts; act on members’ reports.</>,
        <>Meet: create audio or video rooms, choose end-to-end encryption for sensitive calls, and mute, remove or ban people in a call.</>,
        <>Documents: create folders; Society Admins upload files up to 50 MB (members up to 10 MB); move or copy material between your Societies.</>,
        <>Events: add and edit events; members can add them to their own calendars.</>,
      ]} />
    </Sub>
    <Sub title="Projects and Principles">
      <List items={[
        <>Projects: create a project and appoint a Project Manager, who builds the tasks and allocates members; everyone can log risks and issues.</>,
        <>Principles: start from a library (debating, or human rights), edit them into your own, and publish new versions with notes on what changed. Members can request reviews, discuss a principle, or put it to a debate.</>,
      ]} />
    </Sub>
  </> },

  { id: 'ai', title: 'AI settings', short: 'AI', body: <>
    <P>In <strong className="text-slate-100">Manage Societies → AI</strong>, choose how your Society uses AI for quality reviews and News:</P>
    <List items={[
      <Item name="new.vote’s AI:">nothing to set up; usage is tracked against a budget.</Item>,
      <Item name="Your own provider:">connect your organisation’s AI service with its own key and models.</Item>,
      <Item name="Off:">no AI at all; rule-based quality checks still work.</Item>,
    ]} />
    <P>You can see what your Society spends, and set limits to keep it in check.</P>
  </> },

  { id: 'moderation', title: 'Moderation and safety', short: 'Moderation', body: <>
    <P>New contributions are checked automatically for abuse, and members can report anything that worries them. Flagged items arrive in <strong className="text-slate-100">Alert Review</strong>:</P>
    <List items={[
      <Item name="Pass:">it’s fine; it stays as written.</Item>,
      <Item name="Mask:">the content is hidden from view (the original is kept for appeal). Give a reason: the author is told, sees it, and can appeal.</Item>,
      <Item name="Appeals:">authors can appeal a mask; review appeals promptly and fairly.</Item>,
    ]} />
    <P>The new.vote platform team sees the same alerts as a backstop, and can see when you’ve acted. In a private Society they see only that an alert exists, never its content.</P>
    <P>Every uploaded image is checked before it’s saved. A sexually explicit image is refused straight away and held, encrypted, for the new.vote team to review; there’s nothing for you to review.</P>
    <P><strong className="text-slate-100">Younger members.</strong> Members aged under 18 are marked <em>Under 18</em> in your member list and join requests, and aren’t named on your public About page. Reports involving them go to the top of the queue. Members aged 13 to 15 can join video calls only if you run your Society as a youth group (Manage Societies, <em>Young members</em>): turn that on only if a responsible adult supervises its calls.</P>
  </> },

  { id: 'privacy', title: 'Privacy and security', short: 'Privacy', body: <>
    <List items={[
      <>Private Societies are encrypted at rest with their own key; poll ballots are always encrypted.</>,
      <>The platform team has no routine access to a private Society. In a genuine emergency (for example a serious report or a legal requirement) they can open time-limited access, giving a reason. Every such access appears in your <strong className="text-slate-100">Access log</strong> and is emailed to your contact address.</>,
      <>If you see a <em>Temporarily locked</em> notice, the service has restarted and is waiting for its master key; nothing is lost and it will unlock shortly.</>,
      <>Deleting a Society deletes its key, so its encrypted content can never be read again. Be sure before you do it.</>,
    ]} />
  </> },

  { id: 'responsibilities', title: 'Your responsibilities', short: 'Responsibilities', body: <>
    <List items={[
      <>Write clear principles, and apply them to everyone equally. Explain your decisions.</>,
      <>Keep debate fair: both sides get a hearing, arguments are judged on evidence, not on who makes them.</>,
      <>Review alerts, reports and appeals promptly.</>,
      <>Protect your members’ privacy: don’t copy private content out of the Society, and choose visibility thoughtfully.</>,
      <>Keep a working contact email, so the platform team and your members can reach you.</>,
      <>Appoint at least one co-admin, and keep your member list current.</>,
      <>Follow the {a('/privacy', 'privacy policy')} and the site’s terms; tell us about anything unlawful.</>,
    ]} />
  </> },

  { id: 'activity', title: 'Keeping an eye on activity', short: 'Activity', body: <>
    <P>Your Society’s <strong className="text-slate-100">About</strong> page shows totals and recent activity for every tool, over a period you choose. The Debate page shows debate totals and polls; tabs show a badge when there’s something new.</P>
  </> },
];

export default async function AdminGuide() {
  if (!(await getSession().catch(() => null))) return <LoginForGuide name="Admin guide" />;
  return (
    <GuideShell kicker="Admin" title="Admin guide"
      lead={<>For Society Admins: what new.vote is for, how to set up and configure your Society, and what running one involves.</>}
      sections={SECTIONS}
      others={[{ href: '/guides/member', label: 'Member guide' }, { href: '/guides/guest', label: 'Guest guide' }]} />
  );
}
