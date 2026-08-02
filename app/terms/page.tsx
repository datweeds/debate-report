import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: 'Terms and conditions for using debate.report.',
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
          <p className="mt-2 text-slate-500 text-sm">Last updated: July 2026</p>
        </div>

        <div className="space-y-6">

          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using debate.report (the &quot;Platform&quot;), you agree to be bound by these Terms and
              Conditions. If you do not agree to these terms, please do not use the Platform.
            </p>
            <p>
              We reserve the right to update these terms at any time. Continued use of the Platform after changes
              are posted constitutes acceptance of the revised terms.
            </p>
          </Section>

          <Section title="2. User Accounts">
            <p>You must create an account to participate in debates. You are responsible for:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Maintaining the confidentiality of your account credentials.</li>
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
              debate.report a non-exclusive, royalty-free, worldwide licence to display, distribute and use that
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

          <Section title="4. Moderation">
            <p>
              All contributions are subject to review by our moderation team before publication. We reserve the
              right to reject, edit, or remove any content that does not meet our quality standards or violates
              these terms, without obligation to provide reasons.
            </p>
            <p>
              Moderation decisions are final. If you believe a decision was made in error, you may contact us
              via the Contact page.
            </p>
          </Section>

          <Section title="5. Prohibited Conduct">
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

          <Section title="6. Intellectual Property">
            <p>
              The Platform software, design, and branding are the intellectual property of debate.report.
              You may not copy, reproduce, or distribute any part of the Platform without express written permission.
            </p>
            <p>
              User-submitted content remains the intellectual property of the respective authors. By submitting
              content, you confirm you have the right to grant the licence described in Section 3.
            </p>
          </Section>

          <Section title="7. Limitation of Liability">
            <p>
              The Platform is provided &quot;as is&quot; without warranties of any kind. To the maximum extent permitted
              by law, debate.report shall not be liable for any indirect, incidental, or consequential damages
              arising from your use of the Platform.
            </p>
            <p>
              We do not warrant that content submitted by users is accurate, complete, or reliable. You rely
              on such content at your own risk.
            </p>
          </Section>

          <Section title="8. Governing Law">
            <p>
              These terms are governed by the laws of England and Wales. Any disputes shall be subject to
              the exclusive jurisdiction of the courts of England and Wales.
            </p>
          </Section>

          <Section title="9. Contact">
            <p>
              For questions about these terms, please use our{' '}
              <Link href="/contact" className="text-blue-400 hover:underline">Contact page</Link>.
            </p>
          </Section>

        </div>
      </div>
    </div>
  );
}
