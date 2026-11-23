import Link from 'next/link';
import type { Metadata } from 'next';
import { LegalPage, Card, Bullets, A, B } from '@/lib/legalPage';
import { COMPANY } from '@/lib/company';

export const metadata: Metadata = {
  title: 'Service description',
  description: 'What new.vote provides, how it is supported and kept secure, how we handle incidents, and our notice before withdrawing it.',
};

export default function ServicePage() {
  return (
    <LegalPage
      crumbs={[{ href: '/', label: 'Home' }, { label: 'Service description' }]}
      title="Service description"
      updated="23 November 2026"
      intro={<p>
        What new.vote provides, how we support it and keep it secure, what we tell you when something goes wrong, and how much notice
        you&apos;ll get before anything is withdrawn. It forms part of our <Link href="/terms" className={A}>Terms</Link>.
      </p>}
    >
      <Card title="The service">
        <Bullets items={[
          <>new.vote is a hosted service for running Societies: debates, discussions, documents, events, tasks, projects, polls and ballots, video calls and news. The features on each plan are on the <Link href="/pricing" className={A}>Pricing page</Link>.</>,
          <>It is run by {COMPANY.name} (company {COMPANY.number}, registered in {COMPANY.registeredIn}), on servers in France, with all web traffic passing through Cloudflare.</>,
          <>You use it in a web browser on a computer, tablet or phone; there is nothing to install. It can be added to your home screen as an app for notifications.</>,
        ]} />
      </Card>

      <Card title="Availability">
        <Bullets items={[
          <>We aim to keep new.vote available all the time, apart from planned maintenance. We don&apos;t yet guarantee a level of availability.</>,
          <>Planned maintenance is announced on the <Link href="/status" className={A}>status page</Link> at least 48 hours ahead, except urgent security fixes, and is kept short and outside UK daytime where we can.</>,
          <>The <Link href="/status" className={A}>status page</Link> shows whether each part of the service is working, and any current incident.</>,
        ]} />
      </Card>

      <Card title="Support">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-slate-800 text-slate-400"><th className="py-2 pr-4 font-medium">Plan</th><th className="py-2 font-medium">Support</th></tr></thead>
            <tbody className="text-slate-300">
              <tr className="border-b border-slate-800/60"><td className="py-2 pr-4">Huddle</td><td className="py-2"><Link href="/guides" className={A}>Guides</Link> and help pages; email us about your account or safety</td></tr>
              <tr className="border-b border-slate-800/60"><td className="py-2 pr-4">Team</td><td className="py-2">Email, answered as soon as we can</td></tr>
              <tr><td className="py-2 pr-4">Network</td><td className="py-2">Email, answered within 2 working days</td></tr>
            </tbody>
          </table>
        </div>
        <p>On every plan: reports and complaints about content get a reply within 7 days, and security reports are acknowledged within 5 working days (<Link href="/security" className={A}>Security page</Link>). Email <a href={`mailto:${COMPANY.contactEmail}`} className={A}>{COMPANY.contactEmail}</a>.</p>
      </Card>

      <Card title="Maintenance and security">
        <Bullets items={[
          <>New features and fixes are released continually; you never need to update anything.</>,
          <>Security updates are applied to our servers daily. The software new.vote depends on is checked for known vulnerabilities every week.</>,
          <>Vulnerabilities are fixed within <span className={B}>48 hours</span> if critical, <span className={B}>14 days</span> if high and 30 days if medium.</>,
          <>We develop new.vote to the OWASP Application Security Verification Standard (level 2), and follow the UK Software Security Code of Practice.</>,
        ]} />
      </Card>

      <Card title="Your data">
        <Bullets items={[
          <>Everything is backed up nightly, encrypted, to separate storage, and backups are kept for up to 90 days.</>,
          <>You can download your own data, and Society Admins their Society&apos;s, at any time from the <Link href="/my-data" className={A}>Your data</Link> page.</>,
          <>How we handle personal data is in our <Link href="/privacy" className={A}>Privacy Policy</Link>.</>,
        ]} />
      </Card>

      <Card id="incidents" title="Incidents: what we'll tell you">
        <p>An incident is anything that stops new.vote working properly, or puts your data or your safety at risk.</p>
        <Bullets items={[
          <><span className={B}>Outages and faults:</span> we post on the <Link href="/status" className={A}>status page</Link> as soon as we know, aiming for within an hour, and update it as things change and when it&apos;s fixed.</>,
          <><span className={B}>Security incidents and data breaches:</span> we contain the problem first. Where a Society&apos;s data is affected, we tell its Society Admins within 48 hours of finding out, so the organisation can meet its own legal deadlines; we tell affected people directly when there is a high risk to them; and we report to the Information Commissioner within 72 hours where the law requires.</>,
          <><span className={B}>Security fixes:</span> once a vulnerability is fixed, we describe it on the status page if it could have affected you, and thank whoever reported it if they wish.</>,
          <><span className={B}>Afterwards:</span> for a major incident, we publish a short summary within 5 working days: what happened, what was affected, and what we&apos;ve changed so it doesn&apos;t happen again.</>,
        ]} />
      </Card>

      <Card title="Changes, and notice before anything is withdrawn">
        <Bullets items={[
          <>We tell account holders on new.vote at least 30 days before a significant change to a feature they use, or to these terms.</>,
          <>We will give at least <span className={B}>12 months&apos; notice</span> before we stop providing new.vote, end support or security updates for it, or withdraw a paid feature, unless the law or people&apos;s safety requires sooner. You&apos;ll get a refund for any paid period after the service ends.</>,
          <>Throughout that notice you can download everything; from 2027 you&apos;ll also be able to move your Societies to a server of your own.</>,
        ]} />
      </Card>
    </LegalPage>
  );
}
