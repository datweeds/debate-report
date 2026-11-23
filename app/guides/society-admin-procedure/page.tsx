import Link from 'next/link';
import type { Metadata } from 'next';
import { LegalPage, Card, Bullets, A, B } from '@/lib/legalPage';
import { COMPANY } from '@/lib/company';
import { ADMIN_PROCEDURE_VERSION } from '@/lib/adminProcedure';

export const metadata: Metadata = {
  title: 'Society Admin procedure',
  description: 'What every Society Admin on new.vote agrees to check and do to keep their Society and its members safe.',
};

export default function SocietyAdminProcedurePage() {
  return (
    <LegalPage
      crumbs={[{ href: '/', label: 'Home' }, { href: '/guides', label: 'Guides' }, { label: 'Society Admin procedure' }]}
      title="Society Admin procedure"
      updated={ADMIN_PROCEDURE_VERSION}
      intro={<>
        <p>
          When you start a Society you become its Society Admin, and you agree to follow this procedure as well as our{' '}
          <Link href="/terms" className={A}>Terms</Link>. It applies to everyone you make a Society Admin, too. It&apos;s short:
          most Societies need a few minutes a week.
        </p>
        <p>The new.vote team is always behind you: anything possibly illegal comes to us, and we can take over anything you&apos;d rather not handle.</p>
      </>}
    >
      <Card title="Straight away, whenever it happens">
        <Bullets items={[
          <><span className={B}>Someone in immediate danger:</span> call 999 first.</>,
          <><span className={B}>Anything that might be illegal</span>, especially anything sexual involving a child: use its Report button and choose
            &quot;possibly illegal&quot;. It goes straight to the new.vote team. Don&apos;t investigate it yourself, and never download, screenshot or
            share it, even to report it.</>,
          <><span className={B}>A member tells you they&apos;re being harmed</span> or at risk: take it seriously, don&apos;t promise to keep it secret,
            and report it to us (and to the police if someone is in danger).</>,
        ]} />
      </Card>

      <Card title="Every week while your Society is active">
        <Bullets items={[
          <>Check <Link href="/dashboard/scanner" className={A}>Alert Review</Link> and decide every report and flagged item within{' '}
            <span className={B}>7 days</span>: Pass it if it&apos;s fine, Mask it if it breaks the rules, giving a reason. The author is
            told, sees your reason, and can appeal. Items marked{' '}
            <em>Under 18 involved</em> come first.</>,
          <>Answer appeals within 7 days. Judge the content, not the person: strong disagreement isn&apos;t a breach.</>,
          <>Deal with join requests. Admit only people you have reason to admit. A request marked <em>Under 18</em> needs extra thought:
            is your Society right for them?</>,
          <>Don&apos;t review anything about yourself, or written by you: ask another Society Admin or the new.vote team.</>,
        ]} />
      </Card>

      <Card title="Every month">
        <Bullets items={[
          <>Look through your members and Society Admins. Remove anyone who has left, and make sure every Society Admin still needs to be one.</>,
          <>Revoke invite links you no longer use.</>,
          <>Read your Society&apos;s access log (Manage Societies, Privacy): every emergency access by the new.vote team is listed with its reason.</>,
          <>If your Society is a youth group, check it still meets our <Link href="/guides/youth-groups" className={A}>guide for youth groups</Link>.</>,
        ]} />
      </Card>

      <Card title="Every year, and when things change">
        <Bullets items={[
          <>Review your Society&apos;s principles with your members.</>,
          <>Keep your Society&apos;s contact email up to date: we use it for access notices and any security notice.</>,
          <>Before you step down or delete your account, hand the Society to another Society Admin, or close it.</>,
        ]} />
      </Card>

      <Card title="Young members">
        <Bullets items={[
          <>Members under 18 are marked <em>Under 18</em>. Treat them with extra care, and never ask them for personal details or to move a conversation off new.vote.</>,
          <>Turn on <em>Run as a youth group</em> only if your Society is for young people and a responsible adult supervises its calls. Read the{' '}
            <Link href="/guides/youth-groups" className={A}>guide for youth groups</Link> first.</>,
        ]} />
      </Card>

      <Card title="Members' data">
        <Bullets items={[
          <>Use what you see about members (their names, posts and votes) only for running the Society. Don&apos;t copy it elsewhere or share it.</>,
          <>If you run the Society for an organisation, it is responsible for its members&apos; data, and our data processing agreement is
            available from <a href={`mailto:${COMPANY.contactEmail}`} className={A}>{COMPANY.contactEmail}</a>.</>,
          <>Pass on any request from a member about their data (to see it, correct it or delete it) to us if you can&apos;t deal with it yourself.</>,
          <>If you turn on AI, tell your members: their posts are sent to the AI provider your Society chooses.</>,
        ]} />
      </Card>

      <Card title="Keeping your account safe">
        <Bullets items={[
          <>Your account can see and change a lot: sign in with a passkey, keep your recovery code safe, and never share your account.</>,
          <>If you think someone else has used it, tell us straight away.</>,
        ]} />
      </Card>

      <Card title="If this procedure isn't followed">
        <p>
          We may review a Society&apos;s decisions, take over moderation, remove someone as a Society Admin, or close a Society that is badly run
          or used for harm (see the Terms, section 12). Questions? Email{' '}
          <a href={`mailto:${COMPANY.contactEmail}`} className={A}>{COMPANY.contactEmail}</a>.
        </p>
      </Card>
    </LegalPage>
  );
}
