import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How debate.report collects, uses and protects your personal data.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-dr p-7">
      <h2 className="text-xl font-bold text-slate-100 mb-4">{title}</h2>
      <div className="space-y-3 text-sm text-slate-300 leading-relaxed">{children}</div>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-dr-base px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-3xl">

        <div className="mb-10">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
            <Link href="/" className="hover:text-slate-300 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-slate-300">Privacy Policy</span>
          </div>
          <h1 className="text-4xl font-bold text-slate-100">Privacy Policy</h1>
          <p className="mt-2 text-slate-500 text-sm">Last updated: July 2026</p>
        </div>

        <div className="space-y-6">

          <Section title="1. Who We Are">
            <p>
              debate.report is a structured online debate platform. When we refer to &quot;we&quot;, &quot;us&quot; or &quot;our&quot;
              in this policy, we mean the operators of debate.report.
            </p>
            <p>
              For questions about your personal data, please use our{' '}
              <Link href="/contact" className="text-blue-400 hover:underline">Contact page</Link>.
            </p>
          </Section>

          <Section title="2. Data We Collect">
            <p>We collect the following categories of personal data:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <span className="font-semibold text-slate-200">Account data:</span> Your username (handle), email
                address (if provided), and account tier.
              </li>
              <li>
                <span className="font-semibold text-slate-200">Content data:</span> Claims, warrants, evidence,
                rebuttals, comments and votes you submit to the Platform.
              </li>
              <li>
                <span className="font-semibold text-slate-200">Authentication data:</span> Passkey credentials
                used to verify your identity (stored as cryptographic keys, never as passwords).
              </li>
              <li>
                <span className="font-semibold text-slate-200">Usage data:</span> Pages visited, features used,
                and session information for security and performance purposes.
              </li>
              <li>
                <span className="font-semibold text-slate-200">Contact data:</span> Name, email, subject and
                message if you contact us via the Contact page.
              </li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Data">
            <p>We use your personal data to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide and operate the Platform.</li>
              <li>Authenticate you and maintain session security.</li>
              <li>Associate your contributions with your account.</li>
              <li>Respond to enquiries and contact form submissions.</li>
              <li>Prevent abuse, fraud and policy violations.</li>
              <li>Improve the Platform based on usage patterns.</li>
            </ul>
            <p>
              We do not sell, rent, or share your personal data with third parties for marketing purposes.
            </p>
          </Section>

          <Section title="4. Legal Basis for Processing">
            <p>We process your personal data on the following legal bases:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><span className="text-slate-200 font-medium">Contract:</span> To provide the services you have signed up for.</li>
              <li><span className="text-slate-200 font-medium">Legitimate interests:</span> To operate, secure and improve the Platform.</li>
              <li><span className="text-slate-200 font-medium">Consent:</span> Where you have given explicit consent, such as for optional communications.</li>
            </ul>
          </Section>

          <Section title="5. Data Retention">
            <p>
              We retain your account data for as long as your account is active. Content you submit is retained
              as part of the debate record and may remain visible after account deletion, attributed to a
              anonymised identifier.
            </p>
            <p>
              Contact form submissions are retained for up to 12 months for correspondence purposes.
            </p>
          </Section>

          <Section title="6. Cookies and Local Storage">
            <p>
              We use a session cookie (<code className="rounded bg-slate-800 px-1 py-0.5 text-xs font-mono text-blue-300">dr_session</code>) to
              maintain your authenticated session. This is a strictly necessary cookie and does not require consent.
            </p>
            <p>
              We also use <code className="rounded bg-slate-800 px-1 py-0.5 text-xs font-mono text-blue-300">localStorage</code> to
              remember your theme preference (light/dark). No tracking or advertising cookies are used.
            </p>
          </Section>

          <Section title="7. Your Rights">
            <p>Under applicable data protection law, you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access the personal data we hold about you.</li>
              <li>Correct inaccurate personal data.</li>
              <li>Request deletion of your personal data.</li>
              <li>Object to or restrict processing of your personal data.</li>
              <li>Data portability (where applicable).</li>
            </ul>
            <p>
              To exercise any of these rights, please contact us via the{' '}
              <Link href="/contact" className="text-blue-400 hover:underline">Contact page</Link>.
              We will respond within 30 days.
            </p>
          </Section>

          <Section title="8. Security">
            <p>
              We implement appropriate technical and organisational measures to protect your personal data,
              including encrypted session tokens, passkey-based authentication, and access controls.
              No method of data transmission is 100% secure; we cannot guarantee absolute security.
            </p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. When we make material changes, we will
              update the date at the top of this page. Continued use of the Platform after changes are posted
              constitutes acceptance of the revised policy.
            </p>
          </Section>

        </div>
      </div>
    </div>
  );
}
