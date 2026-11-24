import Link from 'next/link';
import type { Metadata } from 'next';
import { LegalPage, Card, Bullets, A, B } from '@/lib/legalPage';
import { COMPANY } from '@/lib/company';

export const metadata: Metadata = {
  title: 'new.vote for young people',
  description: 'Our Terms and Privacy Policy in plain words, for members aged 16 and 17.',
};

export default function YoungPeoplePage() {
  return (
    <LegalPage
      crumbs={[{ href: '/', label: 'Home' }, { label: 'For young people' }]}
      title="new.vote for young people"
      updated="24 November 2026"
      intro={<>
        <p>If you&apos;re 16 or 17, this page explains our rules and how we look after your information, in plain words.</p>
        <p className="text-sm text-slate-400">
          It&apos;s a summary. The full versions are our <Link href="/terms" className={A}>Terms</Link> and{' '}
          <Link href="/privacy" className={A}>Privacy Policy</Link>; if they say something different, they&apos;re what count.
        </p>
      </>}
    >
      <Card title="Who can join">
        <Bullets items={[
          <>You must be <span className={B}>16 or over</span>.</>,
          <>When you join, you tell us your <span className={B}>age group</span>: 16 or 17, or 18 or over. Please be honest: it decides
            the protections you get. If you picked the wrong one, you can change it, but changes are recorded and we may ask you to prove your age.</>,
          <>It&apos;s a good idea to tell a parent or carer that you use new.vote.</>,
        ]} />
      </Card>

      <Card title="What we know about you">
        <Bullets items={[
          <>Your <span className={B}>username</span>, which can be anything (it doesn&apos;t have to be your real name), and your age group.</>,
          <>A name, a short bio and an email address only if you choose to add them. Your bio stays private unless you make it public.</>,
          <>What you post, how you vote, and which Societies you&apos;re in.</>,
          <>For security, our server notes the internet address you visit from. We delete that after 14 days.</>,
        ]} />
      </Card>

      <Card title="What we never do">
        <Bullets items={[
          <>Show you adverts, or sell or share your information for marketing.</>,
          <>Track you on other websites, or work out where you are.</>,
          <>Use tricks to keep you online longer.</>,
        ]} />
      </Card>

      <Card title="Who sees what">
        <Bullets items={[
          <>In a <span className={B}>public</span> Society, anyone can read what you post, next to your username.</>,
          <>In a <span className={B}>private</span> Society, only its members can.</>,
          <>A Society&apos;s admins can see that you&apos;re under 18 (not your exact age group), so they can look out for you. We don&apos;t
            name you on a Society&apos;s public pages.</>,
          <>If your Society uses AI to check debates, what you write may be sent to an AI company to be checked. When it&apos;s new.vote&apos;s own AI, the company doesn&apos;t use it to train its AI.</>,
        ]} />
      </Card>

      <Card title="Staying safe">
        <Bullets items={[
          <>There are no private messages on new.vote, and nobody can search for you.</>,
          <>Every picture is checked when it&apos;s uploaded, and sexual images are blocked.</>,
          <>Never share your address, school, phone number or passwords, and never agree to move a chat somewhere else with someone you don&apos;t know.</>,
          <>If anything worries you, press <span className={B}>Report</span>. The person you report, and the Society&apos;s admins, aren&apos;t told it was you, and
            reports involving under-18s are looked at first.</>,
        ]} />
      </Card>

      <Card title="Our rules">
        <p>
          Disagree as much as you like, but be respectful. No bullying, threats, hate, sexual content, or anything that encourages self-harm.
          If you break the rules, your post can be hidden or your account suspended. If you think we got it wrong, you can appeal from your
          Alerts &amp; Flags page.
        </p>
      </Card>

      <Card title="Your rights">
        <Bullets items={[
          <>On the <Link href="/my-data" className={A}>Your data</Link> page you can download everything you&apos;ve added, and delete your account.</>,
          <>You can ask us what we hold about you, or to correct it, at{' '}
            <a href={`mailto:${COMPANY.contactEmail}`} className={A}>{COMPANY.contactEmail}</a>.</>,
          <>If you&apos;re unhappy with how we handle your information, tell us; you can also complain to the Information Commissioner&apos;s
            Office at <a href="https://ico.org.uk/make-a-complaint/" className={A} target="_blank" rel="noopener noreferrer">ico.org.uk</a>.</>,
        ]} />
      </Card>

      <Card title="Need to talk to someone?">
        <Bullets items={[
          <>If you&apos;re in danger right now, call <span className={B}>999</span>.</>,
          <><span className={B}>Childline</span>: free and private, call 0800 1111 or visit{' '}
            <a href="https://www.childline.org.uk" className={A} target="_blank" rel="noopener noreferrer">childline.org.uk</a>.</>,
          <>If someone online is asking you for sexual pictures or making you feel uncomfortable, you can report it to{' '}
            <a href="https://www.ceop.police.uk/Safety-Centre/" className={A} target="_blank" rel="noopener noreferrer">CEOP</a>.</>,
        ]} />
      </Card>
    </LegalPage>
  );
}
