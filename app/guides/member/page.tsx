import Link from 'next/link';
import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import GuideShell, { Item, List, LoginForGuide, Note, P, Steps, Sub, type GuideSection } from '@/components/guides/GuideShell';

export const metadata: Metadata = { title: 'Member guide', robots: { index: false } };

const a = (href: string, text: string) => <Link href={href} className="text-blue-400 underline underline-offset-2 hover:text-blue-300">{text}</Link>;

const SECTIONS: GuideSection[] = [
  { id: 'welcome', title: 'Welcome', body: <>
    <P>
      new.vote is where communities debate with evidence, decide together and organise. Each community is a
      <strong className="text-slate-100"> Society</strong>. As a member you can take part in its debates and polls, talk,
      meet, share material and help with its projects, whichever of these tools your Society has switched on.
    </P>
  </> },

  { id: 'account', title: 'Your account', short: 'Account', body: <>
    <List items={[
      <>You sign in with a <strong className="text-slate-100">passkey</strong>: your fingerprint, face or device PIN. There’s no password to remember or leak.</>,
      <>Keep your <strong className="text-slate-100">recovery code</strong> somewhere safe; it lets you in if you lose your device. Add passkeys for other devices in {a('/profile', 'your profile')}.</>,
      <>Your username can be anonymous. An email address is optional.</>,
    ]} />
  </> },

  { id: 'joining', title: 'Joining a Society', short: 'Joining', body: <>
    <List items={[
      <Item name="Public Societies:">join with one click.</Item>,
      <Item name="Apply Societies:">ask to join; a moderator approves your request.</Item>,
      <Item name="Invite Societies:">join through an invite link from a member or moderator.</Item>,
    ]} />
    <P>Societies you belong to appear in the menu, with a badge for anything new since you last looked.</P>
  </> },

  { id: 'debate', title: 'Taking part in debates', short: 'Debate', body: <>
    <P>A debate centres on a motion. Arguments for and against are laid out as a map, so you can follow how each point supports or challenges it.</P>
    <List items={[
      <Item name="Add a statement:">a claim, a warrant (the reasoning), evidence, an impact, a rebuttal or a turn, each connected to the point it answers.</Item>,
      <Item name="Vote:">agree or disagree with individual statements; together they show where the debate stands.</Item>,
      <Item name="Back it up:">cite sources. Quality checks flag unsupported points, and may warn you as you write.</Item>,
      <Item name="Flag:">report a statement that breaks the rules, with a reason.</Item>,
    ]} />
    <P>New to structured debate? Read {a('/how-it-works', 'how debate works')}.</P>
  </> },

  { id: 'polls', title: 'Voting in polls', short: 'Polls', body: <>
    <Steps items={[
      <>Open the poll from the Polls tab and answer each question; you’ll see your choices for review before you vote.</>,
      <>Cast your vote. You get a <strong className="text-slate-100">receipt</strong>: copy it somewhere safe.</>,
      <>Paste your receipt into the poll’s <strong className="text-slate-100">audit log</strong> at any time to check your ballot was counted.</>,
    ]} />
    <List items={[
      <>In a <em>secret</em> poll no one, including the moderators and new.vote, can tell how you voted. In a <em>named</em> poll the moderators can; the poll tells you which it is.</>,
      <>If the poll allows it, you can change your vote until it closes. Your new ballot replaces the old one.</>,
    ]} />
  </> },

  { id: 'talk', title: 'Discussions and calls', short: 'Talk', body: <>
    <Sub title="Discussions">
      <P>Start a thread or reply in one, react to posts, and edit or delete your own. If something crosses a line, use <strong className="text-slate-100">Report</strong>: the moderators are told, and your report is kept private.</P>
    </Sub>
    <Sub title="Meet">
      <P>Join a room from the Meet tab with your microphone and camera. In an end-to-end encrypted room you’ll need the passphrase your Society shares; calls there can’t be seen or heard by anyone else, including us. Calls are never recorded.</P>
    </Sub>
  </> },

  { id: 'together', title: 'Working together', short: 'Organise', body: <>
    <List items={[
      <Item name="Documents:">open and download shared files and links; upload your own (up to 10 MB each).</Item>,
      <Item name="Events:">see what’s coming up and add any event to your own calendar.</Item>,
      <Item name="Projects:">see the plan, update the tasks you’re allocated, file status reports, and log risks and issues.</Item>,
      <Item name="Principles:">read the rules your Society runs by, ask for a principle to be reviewed, discuss it, or debate it.</Item>,
      <Item name="News:">read the Society’s magazine of stories on its topics.</Item>,
    ]} />
  </> },

  { id: 'privacy', title: 'Your privacy', short: 'Privacy', body: <>
    <List items={[
      <>Private Societies are encrypted with their own key, and poll ballots always are.</>,
      <>new.vote’s team has no routine access to private Societies; any emergency access is logged and shown to the Society’s moderators.</>,
      <>No ads, no tracking. Read the {a('/privacy', 'privacy policy')} for the details.</>,
    ]} />
  </> },

  { id: 'etiquette', title: 'Taking part well', short: 'Etiquette', body: <>
    <List items={[
      <>Debate the argument, not the person.</>,
      <>Back claims with evidence, and say when something is your opinion.</>,
      <>Represent other views fairly before answering them.</>,
      <>Respect privacy: don’t share personal information, or private Society content, without permission.</>,
      <>Follow your Society’s principles; they’re on its Principles tab.</>,
    ]} />
    <Note>Want to run your own Society? Ask for Moderator tools from {a('/profile', 'your profile')}, then read the {a('/guides/admin', 'Admin guide')}.</Note>
  </> },
];

export default async function MemberGuide() {
  if (!(await getSession().catch(() => null))) return <LoginForGuide name="Member guide" />;
  return (
    <GuideShell kicker="Member" title="Member guide"
      lead={<>How to take part in a Society on new.vote: joining, debating, voting, talking and working together.</>}
      sections={SECTIONS}
      others={[{ href: '/guides/admin', label: 'Admin guide' }, { href: '/guides/guest', label: 'Guest guide' }]} />
  );
}
