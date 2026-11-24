import Link from 'next/link';
import type { Metadata } from 'next';
import { COMPANY } from '@/lib/company';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: 'Terms and conditions for using new.vote.',
};

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="card-dr scroll-mt-20 p-7">
      <h2 className="text-xl font-bold text-slate-100 mb-4">{title}</h2>
      <div className="space-y-3 text-sm text-slate-300 leading-relaxed">{children}</div>
    </div>
  );
}

const A = 'text-blue-400 hover:underline';
const B = 'font-semibold text-slate-200';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-dr-base px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-3xl">

        <div className="mb-10">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
            <Link href="/" className="hover:text-slate-300 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-slate-300">Terms &amp; Conditions</span>
          </div>
          <h1 className="text-4xl font-bold text-slate-100">Terms &amp; Conditions</h1>
          <p className="mt-2 text-slate-500 text-sm">Last updated: 24 November 2026</p>
        </div>

        <div className="space-y-6">

          <Section title="1. About these terms">
            <p>
              new.vote (the &quot;Platform&quot;) is run by {COMPANY.name}, a private limited company registered in{' '}
              {COMPANY.registeredIn}, company number {COMPANY.number}
              {COMPANY.registeredOffice ? <>, registered office {COMPANY.registeredOffice}</> : null}{' '}(&quot;we&quot;, &quot;us&quot;). By accessing or
              using the Platform, you agree to these terms. If you do not agree, please do not use the Platform.
            </p>
            <p>
              If you use new.vote for an organisation, such as running its Society or taking a plan for it, you
              confirm you are allowed to agree to these terms on its behalf.
            </p>
            <p>
              We may update these terms. We will change the date above and, for significant changes, tell account
              holders on the Platform at least 30 days before they take effect. If you keep using the Platform after
              that, the new terms apply; if you don&apos;t agree, you can stop using it and delete your account.
            </p>
          </Section>

          <Section title="2. Who can use new.vote">
            <ul className="list-disc pl-5 space-y-1">
              <li>You must be <span className={B}>16 or over</span> to use new.vote, and you tell us your age group (16 or 17,
                or 18 or over) when you join. Please be honest: it decides the protections you get. You can correct your age group
                later; changes are recorded, and we may ask you to confirm your age. Some features may need an age check before
                you can use them. If we learn that an account belongs to someone under 16, we will put it on hold and close it.</li>
              <li>If you are under 18, please make sure a parent or carer knows you use new.vote. Some protections for
                younger users are described in <a href="#safety" className={A}>section 6</a>, and{' '}
                <Link href="/young-people" className={A}>new.vote for young people</Link> explains these terms in plain words.</li>
              <li>You must be <span className={B}>18 or over</span> to take out a paid plan.</li>
            </ul>
          </Section>

          <Section title="3. Your account">
            <p>You are responsible for:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Keeping your passkey device and your recovery code safe. If you register with only a username and lose
                both, we cannot restore your account.</li>
              <li>All activity that occurs under your account.</li>
              <li>Telling us straight away if you think someone else is using your account.</li>
            </ul>
            <p>
              One person, one account: don&apos;t share an account, and don&apos;t create accounts to get around a
              suspension or to vote more than once.
            </p>
          </Section>

          <Section title="4. Your content">
            <p>
              Your content is everything you add to the Platform: arguments, comments, discussion posts, documents and
              files, events, tasks, polls and votes. It remains yours. By adding it, you give {COMPANY.name} a
              non-exclusive, royalty-free, worldwide licence to store, display and process it as needed to run the
              Platform: for example to show it to the people allowed to see it, to back it up, and to run the AI
              features a Society has turned on.
            </p>
            <p>
              You confirm you have the right to share your content, and that it follows these terms, the law and the
              principles of the Society you post it in.
            </p>
          </Section>

          <Section title="5. What isn't allowed">
            <p>You must not use new.vote to share, or to help anyone share, illegal content. This includes:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>child sexual abuse material, or grooming or sexually exploiting a child;</li>
              <li>terrorist content;</li>
              <li>threats, harassment, stalking, or abuse that stirs up hatred because of race, religion, sexual
                orientation, disability or other protected characteristics;</li>
              <li>encouraging or assisting suicide or serious self-harm;</li>
              <li>intimate images shared without consent, and extreme pornography;</li>
              <li>fraud, scams, and selling drugs, weapons or other illegal goods or services;</li>
              <li>other content that is a criminal offence in the UK, such as threatening communications or false
                communications intended to cause harm.</li>
            </ul>
            <p>You also agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>harass, threaten or abuse other people, including Society Admins;</li>
              <li>post pornography or other sexually explicit material, or content that encourages, promotes or gives
                instructions for suicide, self-harm or eating disorders, even where it would be legal (people as young as
                16 use new.vote);</li>
              <li>post content that is defamatory, or that infringes someone else&apos;s copyright or other rights;</li>
              <li>share someone else&apos;s private information without their permission;</li>
              <li>manipulate votes, polls or engagement, for example by using extra accounts;</li>
              <li>impersonate any person or organisation;</li>
              <li>advertise commercially without permission, or send spam;</li>
              <li>try to access systems or data you aren&apos;t authorised to, or disrupt the Platform;</li>
              <li>make false or malicious reports.</li>
            </ul>
            <p>Societies may set their own principles on top of these rules; they can&apos;t relax them.</p>
          </Section>

          <Section id="safety" title="6. How we keep new.vote safe">
            <p>
              <span className={B}>Automatic checks.</span> New text (debate arguments, discussion posts, comments and
              similar) is checked automatically, on our own server, for abuse, hate, threats and exposed personal
              details. Flagged text is not removed automatically: it goes to the Society&apos;s admins, or to us, for a
              person to review. Every image you upload is also checked, on our own server, before it is saved: a
              sexually explicit image is refused, and held encrypted for up to 30 days so our team can review it, then
              deleted, unless the law requires us to keep it to report it to the authorities. If you think an image was
              refused by mistake, contact us. Content a Society seals (encrypts on members&apos; devices) can&apos;t be
              checked this way.
            </p>
            <p>
              <span className={B}>Reports.</span> Anyone, with or without an account, can report an item they can see
              using its Report button. Most reports go to the Society&apos;s admins. Reports of possibly illegal content,
              and reports about a whole Society or a person, go only to the new.vote team, who review them first; the
              Society&apos;s admins and the author aren&apos;t told. Whoever reviews a report isn&apos;t told who made it,
              except our own team. You can make up to 5 reports a day without an account, or 30 with one.
            </p>
            <p>
              <span className={B}>What we do.</span> When we find content that is illegal or breaks these terms, we
              remove it or stop it being seen, quickly. Depending on how serious it is, we may also warn, suspend or
              close the account responsible, close a Society, and report it to the police or other authorities. Child
              sexual abuse material is always reported to the authorities. In a private Society, our team opens content
              only under time-limited emergency access, which is logged and shown to the Society.
            </p>
            <p>
              <span className={B}>Society Admins</span> can hide, remove or refuse content that breaks these terms or
              their Society&apos;s principles, and remove members. We may review their decisions.
            </p>
            <p>
              <span className={B}>Younger users.</span> We don&apos;t show adverts, track you across other sites or
              collect your location; an email address is optional; and you join a Society only by invitation or with a
              Society Admin&apos;s approval. If you are under 18, Society Admins see that you are, you aren&apos;t named on
              a Society&apos;s public pages, and reports involving you are reviewed first. If something on new.vote worries you, report it,
              and tell an adult you trust.
            </p>
            <p>If someone is in immediate danger, call 999.</p>
          </Section>

          <Section title="7. Complaints and appeals">
            <p>You can complain to us about:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>content you think is illegal or breaks these terms: use its Report button;</li>
              <li>a decision about your own content or account, such as content being hidden or removed, or your account
                being suspended: appeal from the{' '}
                <Link href="/dashboard/alerts" className={A}>Alerts &amp; Flags</Link> page, or contact us;</li>
              <li>an automatic check that wrongly flagged your content;</li>
              <li>how we are meeting our duties under the Online Safety Act 2023, or anything else about how we run
                new.vote: email <a href={`mailto:${COMPANY.contactEmail}`} className={A}>{COMPANY.contactEmail}</a>{' '}
                with &quot;Complaint&quot; in the subject, or use the <Link href="/contact" className={A}>Contact page</Link>.</li>
            </ul>
            <p>
              A person, not a machine, looks at every complaint. We aim to reply within 7 days, and sooner for reports
              of illegal content. If we uphold an appeal, we restore your content or account. Complaining doesn&apos;t
              affect any other rights you have, including going to court.
            </p>
          </Section>

          <Section title="8. Societies and Society Admins">
            <p>
              Each Society is run by its own Society Admins, who decide who may join, set its principles, and moderate
              its content. Society Admins must run their Societies within these terms and the law, follow the{' '}
              <Link href="/guides/society-admin-procedure" className={A}>Society Admin procedure</Link>, and are responsible
              for what they choose to publish and for the members they admit. Each Society has an owner, whose plan
              covers it.
            </p>
            <p>
              Where a Society is run for an organisation, that organisation is the controller of its members&apos; data
              and we process it on its behalf. Our data processing agreement is available on request from{' '}
              <a href={`mailto:${COMPANY.contactEmail}`} className={A}>{COMPANY.contactEmail}</a>.
            </p>
          </Section>

          <Section title="9. Plans and payment">
            <p>
              <span className={B}>Plans belong to a person.</span> Joining, voting and debating are free. Running
              Societies is free on the Pod plan, up to its limits; the Team and Network plans run more Societies, with
              more storage, AI and features, shared across every Society you own. Plans, limits and prices are on the{' '}
              <Link href="/pricing" className={A}>Pricing page</Link>.
            </p>
            <p>
              <span className={B}>Paying.</span> Paid plans are billed in advance, monthly or yearly, through Stripe, and
              renew automatically until you downgrade. We are not currently registered for VAT, so no VAT is charged; if
              that changes, or if prices change, we will tell you at least 30 days before your next payment.
            </p>
            <p>
              <span className={B}>Changing or ending a plan.</span> You can switch plans, or downgrade to Pod, at any
              time on the <Link href="/dashboard/billing" className={A}>Plans &amp; billing</Link> page. A switch takes
              effect straight away, and the difference is charged or credited for the rest of the period. A downgrade
              takes effect at the end of the period you have paid for; we don&apos;t refund part-periods, except as
              below or where the law requires.
            </p>
            <p>
              <span className={B}>14-day refund.</span> If you take out a paid plan as a consumer (not for a business),
              you can cancel within 14 days of your first payment and get a full refund: contact us.
            </p>
            <p>
              <span className={B}>Limits.</span> We warn you when you are close to a limit. If you go over your storage,
              you have 14 days to make room or change plan. If a paid plan ends, it continues for 30 days&apos; grace; after
              that you are on Pod, three of your Societies stay active, and the others are held read-only until you
              choose a plan again or swap which ones are active. Nothing is deleted because a plan ends.
            </p>
            <p>
              If we have given you a plan free of charge, we will give you at least 30 days&apos; notice before it ends.
            </p>
          </Section>

          <Section title="10. AI features and the Debate API">
            <p>
              AI features (such as suggested arguments and quality reports) produce text automatically. It can be
              wrong or incomplete: check it before you rely on it or publish it, and you are responsible for AI
              suggestions you choose to post.
            </p>
            <p>
              The Debate API and guest review links are for the Societies that issue them. Keep tokens secret, use
              them only within the scope they were issued for, and don&apos;t use them to overload the Platform. We
              may revoke a token that is misused.
            </p>
          </Section>

          <Section title="11. Intellectual property">
            <p>
              The Platform software, design and branding are the intellectual property of {COMPANY.name}.
              You may not copy, reproduce or distribute any part of the Platform without express written permission.
            </p>
          </Section>

          <Section title="12. Ending your use">
            <p>
              You can stop using new.vote at any time, download your data and delete your account yourself on the{' '}
              <Link href="/my-data" className={A}>Your data</Link> page. Before you delete an account that owns
              Societies, hand them to another Society Admin or close them.
            </p>
            <p>
              We may suspend or close an account, or close a Society, that seriously or repeatedly breaks these terms,
              and we will tell you why unless the law or someone&apos;s safety prevents it. You can appeal as in section 7.
              We will give at least 12 months&apos; notice before we stop providing new.vote, end support or security
              updates for it, or withdraw a paid feature, unless the law or people&apos;s safety requires sooner, and refund
              any paid period after the service ends. Our <Link href="/service" className={A}>service description</Link> sets
              out how we support new.vote and tell you about incidents.
            </p>
          </Section>

          <Section title="13. Liability">
            <p>
              We work hard to keep new.vote running and your data safe, but the Platform is provided &quot;as is&quot;,
              and we do not warrant that content submitted by users is accurate, complete or reliable.
            </p>
            <p>
              We are not liable for losses that were not foreseeable, for business losses (such as lost profit or
              data you could have exported), or for content posted by others. Our total liability to you is limited to the
              amount you paid us in the 12 months before the claim, or £100 if that is more.
            </p>
            <p>
              Nothing in these terms limits liability for death or personal injury caused by negligence, for fraud, or
              for anything else the law doesn&apos;t allow us to limit, and nothing affects your statutory rights as a
              consumer.
            </p>
          </Section>

          <Section title="14. Governing law">
            <p>
              These terms are governed by the laws of Scotland. Any disputes shall be subject to the jurisdiction of
              the Scottish courts, but if you live elsewhere in the UK you may also bring proceedings in your home
              courts.
            </p>
          </Section>

          <Section title="15. Contact">
            <p>
              For questions about these terms, email{' '}
              <a href={`mailto:${COMPANY.contactEmail}`} className={A}>{COMPANY.contactEmail}</a>{' '}
              or use our <Link href="/contact" className={A}>Contact page</Link>. How we
              handle personal data is set out in our <Link href="/privacy" className={A}>Privacy Policy</Link>.
            </p>
          </Section>

        </div>
      </div>
    </div>
  );
}
