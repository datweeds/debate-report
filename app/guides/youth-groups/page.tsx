import Link from 'next/link';
import type { Metadata } from 'next';
import { LegalPage, Card, Bullets, A, B } from '@/lib/legalPage';
import { COMPANY } from '@/lib/company';

export const metadata: Metadata = {
  title: 'Running a youth group',
  description: 'Guidance for Society Admins running a Society for young people on new.vote: calls, privacy and reporting.',
};

export default function YouthGroupsGuidePage() {
  return (
    <LegalPage
      crumbs={[{ href: '/', label: 'Home' }, { href: '/guides', label: 'Guides' }, { label: 'Running a youth group' }]}
      title="Running a youth group"
      updated="23 November 2026"
      intro={<p>
        School debating clubs, youth councils and youth sections can run a Society on new.vote. This guide is for the adults who run them.
        It adds to the <Link href="/guides/society-admin-procedure" className={A}>Society Admin procedure</Link>; your own organisation&apos;s
        safeguarding policy comes first.
      </p>}
    >
      <Card title="Before you start">
        <Bullets items={[
          <>A youth group needs at least one <span className={B}>responsible adult</span> as a Society Admin, who is accountable for it.
            Two adults are better: they can cover for each other and no adult is ever alone with young people.</>,
          <>Follow your organisation&apos;s safeguarding policy. Adults who work with children may need background checks (the PVG scheme in
            Scotland, DBS checks in England and Wales): your organisation will know.</>,
          <>Turn on <span className={B}>Run as a youth group</span> in Manage Societies (Young members). Until you do, members aged 13 to 15
            can&apos;t join your calls.</>,
        ]} />
      </Card>

      <Card title="Keep the Society private">
        <Bullets items={[
          <>Make the Society <span className={B}>private</span>, so only members see it, and its content is encrypted on our server.</>,
          <>Admit people only by invitation or approval, and only people you know belong in the group. Use invite links that expire, and
            revoke them after use.</>,
          <>Check new members: an adult asking to join a youth group needs a good reason.</>,
          <>Leave <em>Sealed</em> items switched off. Sealed content can&apos;t be checked by our scanners or by our team.</>,
        ]} />
      </Card>

      <Card title="Video calls">
        <Bullets items={[
          <>Calls with young people should be <span className={B}>supervised by a responsible adult</span>, scheduled on the Society&apos;s calendar,
            and open to the group, never one adult with one young person.</>,
          <>Use the Society&apos;s normal rooms, not end-to-end encrypted ones: an encrypted room can&apos;t be reviewed if something goes wrong.
            Calls are never recorded.</>,
          <>You can lock a room, and remove anyone from it.</>,
        ]} />
      </Card>

      <Card title="Content and conduct">
        <Bullets items={[
          <>Agree the group&apos;s principles with its members: respectful debate, no personal attacks, no sharing personal details.</>,
          <>Every image is checked for explicit content when it&apos;s uploaded, and text is checked for abuse; you&apos;ll see flagged items in
            Alert Review, with anything involving an under-18 first.</>,
          <>Remind members they can use the Report button on anything that worries them, and that they can talk to you.</>,
        ]} />
      </Card>

      <Card title="If something worries you">
        <Bullets items={[
          <><span className={B}>A child in immediate danger:</span> call 999.</>,
          <><span className={B}>Possible abuse or grooming on new.vote:</span> report the item as &quot;possibly illegal&quot;; it goes straight to
            the new.vote team. Don&apos;t confront the person, and never copy or share any image.</>,
          <><span className={B}>A young person tells you something worrying:</span> listen, don&apos;t promise to keep it secret, write down what
            they said, and follow your organisation&apos;s safeguarding procedure.</>,
          <>Advice for adults: the NSPCC helpline, 0808 800 5000. Young people can talk to Childline on 0800 1111, and report online sexual
            abuse to CEOP at <a href="https://www.ceop.police.uk/Safety-Centre/" className={A} target="_blank" rel="noopener noreferrer">ceop.police.uk</a>.</>,
          <>Tell us too: <a href={`mailto:${COMPANY.contactEmail}`} className={A}>{COMPANY.contactEmail}</a>.</>,
        ]} />
      </Card>

      <Card title="Point your members to">
        <p>
          Our page for young people, <Link href="/young-people" className={A}>new.vote for young people</Link>, explains in plain words what we
          collect, who sees what, and how to stay safe.
        </p>
      </Card>
    </LegalPage>
  );
}
