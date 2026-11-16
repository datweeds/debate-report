import Link from 'next/link';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { keyHeldOffline } from '@/lib/masterKey';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How new.vote collects, uses and protects your personal data.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-dr p-7">
      <h2 className="text-xl font-bold text-slate-100 mb-4">{title}</h2>
      <div className="space-y-3 text-sm text-slate-300 leading-relaxed">{children}</div>
    </div>
  );
}

export default async function PrivacyPage() {
  await connection();  // where the master key is kept can change: read it per request
  const keyOffline = keyHeldOffline();
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
          <p className="mt-2 text-slate-500 text-sm">Last updated: November 2026</p>
        </div>

        <div className="space-y-6">

          <Section title="Your privacy at a glance">
            <p>
              <span className="text-slate-200 font-medium">You don&apos;t need to give us personal details.</span>{' '}
              Register with just a username — it can be anonymous. An email address is optional, and only used for
              the newsletter if you choose to give one.
            </p>
            <p>
              <span className="text-slate-200 font-medium">There are no passwords.</span>{' '}
              You sign in with a passkey: its private key is created on your own device and never leaves it. We store
              only the matching public key, which can&apos;t be used to sign in as you. Your one-time recovery code is
              shown to you once; we keep only a scrambled (one-way) copy that we can&apos;t read back.
            </p>
            <p>
              <span className="text-slate-200 font-medium">Private Societies and private debates are encrypted on our server.</span>{' '}
              A private Society&apos;s debates, discussions, documents, events, projects, principles and flagged content, and
              Apply and Invite debates in public Societies, are stored encrypted with the Society&apos;s own key
              {keyOffline
                ? <>, and the master key that unlocks those keys is never stored on our servers (see Security, below).</>
                : <>.</>}{' '}
              Everything else, including public Societies&apos; content, public debates and who voted which way, is
              encrypted while travelling to and from us (HTTPS) but stored without encryption.
            </p>
            <p>
              <span className="text-slate-200 font-medium">Private means private from our administrators too.</span>{' '}
              Private Societies are visible only to their members and moderators. Our administrators have no routine
              access to them; emergency access is time-limited, needs a reason, and is logged and shown to the Society.
              In public Societies, administrators can remove content to stop abuse.
            </p>
            <p>
              <span className="text-slate-200 font-medium">What our servers record.</span>{' '}
              Our web server logs visitors&apos; IP addresses and the pages requested, for security. These logs are
              deleted after 14 days.
            </p>
            <p>
              <span className="text-slate-200 font-medium">Who else handles data.</span>{' '}
              AI features (quality reports, analysis, the argument assistant) send the relevant debate text to
              Anthropic to process. Emails (the contact form and newsletter) are delivered by Postmark. Automatic
              abuse scanning runs on our own server.
            </p>
          </Section>

          <Section title="1. Who We Are">
            <p>
              new.vote is operated by <span className="text-slate-200 font-medium">Debate Report Limited</span>,
              a private limited company registered in Scotland. When we refer to &quot;we&quot;, &quot;us&quot; or &quot;our&quot;
              in this policy, we mean Debate Report Limited.
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
              We use only strictly necessary cookies, which don&apos;t require consent: one keeps you signed in,
              one remembers which Society you&apos;re in, one holds a guest access key if you were sent a review link,
              and a short-lived one protects passkey sign-in.
            </p>
            <p>
              We also use your browser&apos;s local storage for display preferences, such as light or dark theme and
              which menu sections are open. No tracking or advertising cookies are used.
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
            <p className="mt-3">
              <strong>Private Societies.</strong> The debates (every argument, chat message, closing statement and
              quality report), discussions, documents (including uploaded files and folder names), events,
              projects (with their tasks, status reports and risk logs), principles (with review requests and version notes)
              and flagged content of a private Society are stored encrypted with that Society&apos;s own key. This protects them in our database,
              backups and storage; the site decrypts them to show them to the Society&apos;s members. If a Society is deleted,
              its key is deleted too, and its encrypted content can no longer be read.
            </p>
            <p className="mt-3">
              <strong>Private debates in public Societies.</strong> Debates a public Society sets to Apply or Invite are
              stored encrypted in the same way, with that Society&apos;s key. Votes are counted openly and are not encrypted.
            </p>
            {keyOffline && (
              <p className="mt-3">
                <strong>The master key is kept offline.</strong> Each Society&apos;s key is itself encrypted with a master key
                that is never stored on our servers, in our database or in our backups. It is held offline by new.vote&apos;s
                operator and supplied by hand each time the service starts, after which it exists only in the running
                service&apos;s memory. So a copy of our database or backups, a disk removed from the data centre, our hosting
                provider&apos;s staff, or anyone who seizes our servers while they are switched off, finds only encrypted data
                that can&apos;t be read. Until the key is supplied after a restart, private Societies are simply locked; nothing
                is lost.
              </p>
            )}
            <p className="mt-3">
              Our system administrators have no routine access to a private Society&apos;s content. In an emergency, such as
              a serious report or a legal requirement, an administrator may open time-limited access, giving a reason. Every
              such access is logged, shown to the Society&apos;s moderators and emailed to the Society&apos;s contact address.
            </p>
            <p className="mt-3">
              <strong>Calls.</strong> Audio and video calls are encrypted in transit and are never recorded. In rooms a
              Society marks as end-to-end encrypted, calls are encrypted on your device with a passphrase members share
              among themselves, so not even we can see or hear them.
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
