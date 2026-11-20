import Link from 'next/link';
import type { Metadata } from 'next';
import { COMPANY } from '@/lib/company';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: 'Terms and conditions for using new.vote.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-dr p-7">
      <h2 className="text-xl font-bold text-slate-100 mb-4">{title}</h2>
      <div className="space-y-3 text-sm text-slate-300 leading-relaxed">{children}</div>
    </div>
  );
}

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
          <p className="mt-2 text-slate-500 text-sm">Last updated: 18 November 2026</p>
        </div>

        <div className="space-y-6">

          <Section title="1. Acceptance of Terms">
            <p>
              new.vote (the &quot;Platform&quot;) is run by {COMPANY.name}, a private limited company registered in{' '}
              {COMPANY.registeredIn}, company number {COMPANY.number}
              {COMPANY.registeredOffice ? <>, registered office {COMPANY.registeredOffice}</> : null}{' '}(&quot;we&quot;, &quot;us&quot;). By accessing or
              using the Platform, you agree to be bound by these Terms and Conditions. If you do not agree to these
              terms, please do not use the Platform.
            </p>
            <p>
              We may update these terms. We will change the date above and, for significant changes, tell account
              holders on the Platform before they take effect. Continued use of the Platform after that constitutes
              acceptance of the revised terms.
            </p>
          </Section>

          <Section title="2. User Accounts">
            <p>You must create an account to participate in debates. You are responsible for:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Keeping your passkey device and your recovery code safe. If you register with only a username and lose
                both, we cannot restore your account.</li>
              <li>All activity that occurs under your account.</li>
              <li>Providing accurate information when registering.</li>
              <li>Notifying us immediately of any unauthorised use of your account.</li>
            </ul>
            <p>
              We reserve the right to suspend or terminate accounts that violate these terms or engage in
              conduct detrimental to the Platform or its community.
            </p>
          </Section>

          <Section title="3. User-Generated Content">
            <p>
              By submitting content (claims, warrants, evidence, rebuttals, comments) to the Platform, you grant
              new.vote a non-exclusive, royalty-free, worldwide licence to display, distribute and use that
              content within the Platform.
            </p>
            <p>You represent and warrant that your content:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Does not infringe any third-party intellectual property rights.</li>
              <li>Is not false, misleading, defamatory, or in breach of applicable law.</li>
              <li>Does not contain personal attacks, hate speech, or harassment.</li>
              <li>Complies with our Community Standards and debating guidelines.</li>
            </ul>
          </Section>

          <Section title="4. Societies and Moderation">
            <p>
              Each Society is run by its own moderators, who decide who may join, set its principles, and moderate
              its content. Moderators must run their Societies within these terms and the law, and are responsible
              for what they choose to publish and for the members they admit.
            </p>
            <p>
              New content is scanned automatically for abuse and may be flagged for review. Society moderators and
              our own team may hide, remove or refuse content that breaks these terms, a Society&apos;s principles or
              the law, and may suspend accounts. If your content is masked or removed, you can appeal from the{' '}
              <Link href="/dashboard/alerts" className="text-blue-400 hover:underline">Alerts &amp; Flags</Link> page, or contact us.
            </p>
          </Section>

          <Section title="5. Paid Plans">
            <p>
              Some features, such as running your own Societies, are part of paid plans described on the{' '}
              <Link href="/pricing" className="text-blue-400 hover:underline">Pricing page</Link>. Prices include VAT
              where it applies. Plans are billed in advance through Stripe and renew automatically until you cancel.
              You can cancel at any time; your plan then runs to the end of the period you have paid for, and is not
              refunded for part-periods unless the law requires it.
            </p>
            <p>
              While billing is in preview, paid features are switched on free of charge at our discretion. We will
              give you at least 30 days&apos; notice, and ask for your agreement, before charging you.
            </p>
            <p>
              If a plan ends, your Societies and their content are kept for at least 90 days, so you can renew or
              export what you need.
            </p>
          </Section>

          <Section title="6. AI Features and the Debate API">
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

          <Section title="7. Prohibited Conduct">
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Submit false, fabricated, or deliberately misleading content.</li>
              <li>Harass, threaten, or abuse other users or moderators.</li>
              <li>Attempt to manipulate voting or engagement metrics.</li>
              <li>Use the Platform for commercial advertising without prior consent.</li>
              <li>Attempt to access systems or data beyond your authorised scope.</li>
              <li>Impersonate any person or entity.</li>
            </ul>
          </Section>

          <Section title="8. Intellectual Property">
            <p>
              The Platform software, design, and branding are the intellectual property of {COMPANY.name}.
              You may not copy, reproduce, or distribute any part of the Platform without express written permission.
            </p>
            <p>
              User-submitted content remains the intellectual property of the respective authors. By submitting
              content, you confirm you have the right to grant the licence described in Section 3.
            </p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>
              The Platform is provided &quot;as is&quot; without warranties of any kind. To the maximum extent permitted
              by law, we shall not be liable for any indirect, incidental, or consequential damages arising from
              your use of the Platform. Nothing in these terms limits liability that cannot be limited by law, or
              your statutory rights as a consumer.
            </p>
            <p>
              We do not warrant that content submitted by users is accurate, complete, or reliable. You rely
              on such content at your own risk.
            </p>
          </Section>

          <Section title="10. Governing Law">
            <p>
              These terms are governed by the laws of Scotland. Any disputes shall be subject to the jurisdiction of
              the Scottish courts, but if you live elsewhere in the UK you may also bring proceedings in your home
              courts.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              For questions about these terms, email{' '}
              <a href={`mailto:${COMPANY.contactEmail}`} className="text-blue-400 hover:underline">{COMPANY.contactEmail}</a>{' '}
              or use our <Link href="/contact" className="text-blue-400 hover:underline">Contact page</Link>. How we
              handle personal data is set out in our <Link href="/privacy" className="text-blue-400 hover:underline">Privacy Policy</Link>.
            </p>
          </Section>

        </div>
      </div>
    </div>
  );
}
