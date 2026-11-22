import Link from 'next/link';
import type { Metadata } from 'next';
import GuideShell, { Item, List, Note, P, Steps, type GuideSection } from '@/components/guides/GuideShell';

export const metadata: Metadata = {
  title: 'Guest guide',
  description: 'What you can see and do on new.vote without an account, and what more you can do when you join or create a Society.',
};

const a = (href: string, text: string) => <Link href={href} className="text-blue-400 underline underline-offset-2 hover:text-blue-300">{text}</Link>;

const SECTIONS: GuideSection[] = [
  { id: 'about', title: 'What new.vote is', short: 'About', body: <>
    <P>
      new.vote is a home for communities online: places where people debate with evidence, decide together and organise.
      Each community is a <strong className="text-slate-100">Society</strong>, run by its own members and Society Admins.
      You’re welcome to look around before you join.
    </P>
  </> },

  { id: 'see', title: 'What you can see without an account', short: 'See', body: <>
    <List items={[
      <Item name="Public Societies:">their debates, with every argument mapped and the votes behind it.</Item>,
      <Item name="Their tools:">polls and their results (where the Society shows them), news, documents, events, projects and principles.</Item>,
      <Item name="Private Societies:">Apply Societies show a summary so you can ask to join; Invite Societies are hidden.</Item>,
      <Item name="About new.vote:">{a('/features', 'all the features')}, {a('/how-it-works', 'how debate works')}, the {a('/blog', 'newsletter')} and our {a('/privacy', 'privacy policy')}.</Item>,
    ]} />
    <Note>Discussions are for members only, and taking part in a debate or a call needs an account.</Note>
  </> },

  { id: 'do', title: 'What you can do', short: 'Do', body: <>
    <List items={[
      <Item name="Vote with an access code:">if a Society has given you a one-use code for a poll, you can vote without an account, get a receipt, and check your vote was counted.</Item>,
      <Item name="Review with a guest link:">if you’ve been sent a review link, it opens chosen debates for a limited time.</Item>,
      <Item name="Subscribe:">get the newsletter by email.</Item>,
      <Item name="Get in touch:">use the {a('/contact', 'contact form')} for questions or feedback.</Item>,
    ]} />
  </> },

  { id: 'join', title: 'Join a Society', short: 'Join', body: <>
    <Steps items={[
      <>{a('/pricing', 'Sign up')}: just a username and a passkey on your device. No password, and no email unless you want one. It’s free.</>,
      <>Find a Society on the {a('/#societies', 'home page')}. Join a public one with one click, or ask to join an Apply one.</>,
    ]} />
    <P>As a member you can add arguments and evidence to debates, vote on every point, vote in polls (secretly, with a receipt), join discussions and calls, share documents, help with projects, and help shape your Society’s principles.</P>
  </> },

  { id: 'create', title: 'Create your own Society', short: 'Create', body: <>
    <P>
      Anyone with an account can start a Society and become its Society Admin: public, by application, or invitation-only and
      encrypted. Society Admins choose which tools to switch on, invite members, run debates and polls, and look after the
      community. Every Society starts on Huddle, which is free.
    </P>
    <Steps items={[
      <>{a('/pricing', 'Sign up')} for free.</>,
      <>Choose <strong className="text-slate-100">Start a Society</strong> from the menu.</>,
      <>Create your Society, and read the Admin guide for everything else.</>,
    ]} />
  </> },

  { id: 'privacy', title: 'Your privacy as a visitor', short: 'Privacy', body: <>
    <P>There are no ads and no tracking. We use only the cookies the site needs to work. Our web server records visitors’ IP addresses for security, as the {a('/privacy', 'privacy policy')} explains.</P>
  </> },
];

export default function GuestGuide() {
  return (
    <GuideShell kicker="Guest" title="Guest guide"
      lead={<>Visiting new.vote without an account? Here’s what you can see and do, and what opens up when you join a Society or create your own.</>}
      sections={SECTIONS}
      others={[{ href: '/guides/member', label: 'Member guide' }, { href: '/guides/admin', label: 'Admin guide' }]} />
  );
}
