import Link from 'next/link';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { keyHeldOffline } from '@/lib/masterKey';
import { COMPANY } from '@/lib/company';

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
          <p className="mt-2 text-slate-500 text-sm">Last updated: 21 November 2026</p>
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
              shown to you once; we keep only a scrambled (one-way) copy that we can&apos;t read back. Keep that code
              safe: if you lose both your passkey and your recovery code, we can&apos;t restore an account that has only a
              username, because we have no way to tell that it&apos;s yours. You can register a new one.
            </p>
            <p>
              <span className="text-slate-200 font-medium">Private Societies and private debates are encrypted on our server.</span>{' '}
              A private Society&apos;s debates, discussions, documents, events, projects, principles and flagged content, and
              Apply and Invite debates in public Societies, are stored encrypted with the Society&apos;s own key
              {keyOffline
                ? <>, and the master key that unlocks those keys is never stored on our servers (see Security, below).</>
                : <>.</>}{' '}
              Poll ballots are stored encrypted in every Society, public or private. Everything else, including public
              Societies&apos; content, public debates, and For and Against votes on debates and statements, is encrypted
              while travelling to and from us (HTTPS) but stored without encryption.
            </p>
            <p>
              <span className="text-slate-200 font-medium">Private Societies are closed to our administrators.</span>{' '}
              Private Societies are visible only to their members and Society Admins. Our administrators have no routine
              access to them; emergency access is time-limited, needs a reason, and is logged and shown to the Society.
              This is encryption at rest, not end-to-end encryption: our server decrypts a private Society&apos;s content
              to show it to its members, and to send it to the AI the Society has chosen, if any. Only Meet rooms marked
              end-to-end encrypted are beyond our reach. In public Societies, administrators can remove content to stop abuse.
            </p>
            <p>
              <span className="text-slate-200 font-medium">What our servers record.</span>{' '}
              Our web server logs visitors&apos; IP addresses and the pages requested, for security, and our application
              logs errors. Both are deleted after 14 days.
            </p>
            <p>
              <span className="text-slate-200 font-medium">Who else handles data.</span>{' '}
              AI features (quality reports, news summaries, the argument assistant) send the relevant text to the AI the
              Society has chosen: new.vote&apos;s own (Anthropic), the Society&apos;s own provider, or none. Emails are
              delivered by Postmark, and payments are handled by Stripe. Automatic abuse scanning runs on our own server.
              See <a href="#processors" className="text-blue-400 hover:underline">who handles your data</a>, below.
            </p>
          </Section>

          <Section title="1. Who We Are">
            <p>
              new.vote is operated by <span className="text-slate-200 font-medium">{COMPANY.name}</span>,
              a private limited company registered in {COMPANY.registeredIn}, company number {COMPANY.number}
              {COMPANY.registeredOffice ? <>, with its registered office at {COMPANY.registeredOffice}</> : null}.
              We are the controller of the personal data described here. When we refer to &quot;we&quot;, &quot;us&quot; or
              &quot;our&quot; in this policy, we mean {COMPANY.name}.
            </p>
            {COMPANY.icoNumber && (
              <p>We are registered with the Information Commissioner&apos;s Office (ICO), registration number {COMPANY.icoNumber}.</p>
            )}
            <p>
              For questions about your personal data, email{' '}
              <a href={`mailto:${COMPANY.contactEmail}`} className="text-blue-400 hover:underline">{COMPANY.contactEmail}</a>{' '}
              or use our <Link href="/contact" className="text-blue-400 hover:underline">Contact page</Link>.
            </p>
            <p>
              Each Society&apos;s admins decide who may join it and what its members can see. Where a Society uses its
              own AI provider, that choice, and the Society&apos;s agreement with that provider, are the Society&apos;s.
            </p>
          </Section>

          <Section title="2. Data We Collect">
            <p>We collect the following categories of personal data:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <span className="font-semibold text-slate-200">Account data:</span> Your username (handle), email
                address (if provided), account tier, and the Societies you belong to.
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
                <span className="font-semibold text-slate-200">Usage data:</span> The web server&apos;s record of each
                request (IP address, page, time and browser), kept for security; and a record of each AI request a
                Society makes (the task, model, size and cost, but not the content).
              </li>
              <li>
                <span className="font-semibold text-slate-200">Reports:</span> If you report an item (an event, a
                reply, a document and so on), we keep the item, your reason and any note you add. If you&apos;re signed
                in, we record your account so we can stop repeated or abusive reports; the Society&apos;s admins
                and the person you report are never told who you are. If you report without an account, we keep only a
                scrambled code made from your IP address, which changes every day, to limit you to 5 reports a day.
                It can&apos;t be turned back into your address or linked across days, and is deleted after two days.
              </li>
              <li>
                <span className="font-semibold text-slate-200">Contact data:</span> Name, email, subject and
                message if you contact us via the Contact page.
              </li>
              <li>
                <span className="font-semibold text-slate-200">Newsletter data:</span> Your email address and name (if
                given), if you subscribe.
              </li>
              <li>
                <span className="font-semibold text-slate-200">Payment data:</span> If you take a paid plan, Stripe
                collects your card details; we receive only the plan, its status and a Stripe customer reference.
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
              <li><span className="text-slate-200 font-medium">Legal obligation:</span> To handle reports of illegal and harmful content under the Online Safety Act 2023.</li>
              <li><span className="text-slate-200 font-medium">Consent:</span> Where you have given explicit consent, such as for optional communications.</li>
            </ul>
          </Section>

          <Section title="5. Data Retention">
            <ul className="list-disc pl-5 space-y-1">
              <li><span className="text-slate-200 font-medium">Account data</span>, passkey public keys and the scrambled
                recovery code: while your account exists. A passkey you remove is deleted straight away.</li>
              <li><span className="text-slate-200 font-medium">Content you submit:</span> kept as part of the debate record. It
                may remain visible after your account is deleted, attributed to an anonymised identifier. A deleted
                Society&apos;s encrypted content can no longer be read, because its key is deleted with it.</li>
              <li><span className="text-slate-200 font-medium">Web server and application logs:</span> 14 days.</li>
              <li><span className="text-slate-200 font-medium">Records of AI requests</span> (no content): kept for
                accounting while the Society exists.</li>
              <li><span className="text-slate-200 font-medium">Newsletter:</span> until you unsubscribe. After that we keep your
                address marked as unsubscribed, so we never email you again; ask us and we&apos;ll delete it entirely.</li>
              <li><span className="text-slate-200 font-medium">Reports</span> and moderation decisions: kept with the
                Society&apos;s moderation record while the Society exists. A Society with an unreviewed report of possibly
                illegal content can&apos;t be deleted until we have reviewed it, and such reports may be kept longer, or
                passed to the police, where the law requires.</li>
              <li><span className="text-slate-200 font-medium">Contact form messages:</span> up to 12 months.</li>
              <li><span className="text-slate-200 font-medium">Payment records:</span> as long as UK tax law requires
                (currently six years).</li>
            </ul>
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
              To exercise any of these rights, email{' '}
              <a href={`mailto:${COMPANY.contactEmail}`} className="text-blue-400 hover:underline">{COMPANY.contactEmail}</a>{' '}
              or use the <Link href="/contact" className="text-blue-400 hover:underline">Contact page</Link>.
              We will respond within one month. Where we rely on your consent, you can withdraw it at any time.
            </p>
            <p>
              If you&apos;re unhappy with how we handle your data, please tell us first. You also have the right to
              complain to the Information Commissioner&apos;s Office (ICO):{' '}
              <a href="https://ico.org.uk/make-a-complaint/" className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">ico.org.uk/make-a-complaint</a>,
              or 0303 123 1113.
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
              <strong>Polls.</strong> Every poll ballot is stored encrypted with its Society&apos;s key, whether the Society is
              public or private. In a secret poll, the record of who has voted is kept separate from the ballots, and a ballot
              carries no time and no name: only a token derived from a key we keep off the database, so a copy of our database
              can&apos;t connect a ballot to a voter. Each voter receives a receipt; a scrambled form of it is listed in the poll&apos;s
              audit log so they can check their ballot was counted. In a named poll, the Society&apos;s admins can see who chose what.
              People without an account can be given a one-use access code; we keep only a scrambled form of the code.
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
              such access is logged, shown to the Society&apos;s admins and emailed to the Society&apos;s contact address.
            </p>
            <p className="mt-3">
              <strong>Calls.</strong> Audio and video calls are encrypted in transit and are never recorded. In rooms a
              Society marks as end-to-end encrypted, calls are encrypted on your device with a passphrase members share
              among themselves, so not even we can see or hear them.
            </p>
          </Section>

          <Section title="9. AI Features">
            <p>
              Each Society chooses the AI used for its content: new.vote&apos;s own (Anthropic&apos;s Claude models), its
              own provider and key, or none. A Society&apos;s administrators change this on the Manage Societies page, in its AI card.
            </p>
            <p>
              When an AI feature runs (a Debate Quality Report, the argument assistant, News edition summaries), the
              relevant text is sent to that provider. For a private Society, or an Apply or Invite debate, that text is
              decrypted on our server first, because the AI can&apos;t work on encrypted text. A Society that doesn&apos;t
              want its content to leave new.vote can switch AI off, or use a model running on its own server; the
              features then work without AI or are unavailable. Anthropic does not use data sent through its API to
              train its models.
            </p>
            <p>
              The News feature sends a Society&apos;s topic search phrases (not its members&apos; content) to our news
              service, which searches news sources and the OpenAlex index of research papers.
            </p>
          </Section>

          <Section title="10. Who Handles Your Data">
            <p id="processors">These organisations process personal data for us, under data processing terms:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><span className="text-slate-200 font-medium">Contabo GmbH</span> (EU): hosts our servers, including calls,
                abuse scanning and the news service.</li>
              <li><span className="text-slate-200 font-medium">Postmark</span> (ActiveCampaign, USA): delivers emails.</li>
              <li><span className="text-slate-200 font-medium">Anthropic</span> (USA): runs AI features for Societies that
                use new.vote&apos;s AI.</li>
              <li><span className="text-slate-200 font-medium">Stripe</span>: takes payments for paid plans.</li>
            </ul>
            <p>
              Postmark and Anthropic are in the United States, so using them transfers data outside the UK. These
              transfers are protected by the providers&apos; data processing terms, which include the safeguards UK
              law requires (the UK International Data Transfer Addendum or equivalent).
            </p>
          </Section>

          <Section title="11. Children">
            <p>
              new.vote is not intended for children under 13, and we don&apos;t knowingly collect their personal data.
              If you believe a child under 13 has an account, contact us and we will delete it.
            </p>
          </Section>

          <Section title="12. Changes to This Policy">
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
