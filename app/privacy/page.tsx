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
          <p className="mt-2 text-slate-500 text-sm">Last updated: 24 November 2026</p>
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
              <span className="text-slate-200 font-medium">AI companies.</span>{' '}
              We tell AI companies not to collect members&apos; content to train their models: our robots.txt file and our
              network provider (Cloudflare) block known AI training crawlers from debates, Societies, polls, profiles and
              uploaded files. They may read our own pages, such as Features, Pricing, the Guides and these policies.
              Search engines can still index public Societies, and AI assistants can still open a public page when someone
              asks them to, as a browser would. Not every crawler obeys these rules, so treat anything you post in a public
              Society as public.
            </p>
            <p>
              <span className="text-slate-200 font-medium">What our servers record.</span>{' '}
              Our web server logs visitors&apos; IP addresses and the pages requested, for security, and our application
              logs errors. Both are deleted after 14 days.
            </p>
            <p>
              <span className="text-slate-200 font-medium">Who else handles data.</span>{' '}
              AI features (quality reports, news summaries, the argument assistant) send the relevant text to the AI the
              Society has chosen: new.vote&apos;s own (Anthropic), the Society&apos;s own provider, or none. All traffic
              passes through Cloudflare, which protects the site from attacks. Emails are delivered by Postmark, and
              payments are handled by Stripe. Automatic abuse scanning, of text and of uploaded images, runs on our own
              server, so nothing is sent elsewhere to be checked.
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
                address (if provided), account tier, the Societies you belong to and your role in each, your age
                group (16 or 17, or 18 or over: never your date of birth), any changes you make to it, and your agreement to our Terms.
                Your age group is used only for safety: the Society Admins of Societies you belong to, or ask to join,
                see whether you are under 18, but not your age group.
              </li>
              <li>
                <span className="font-semibold text-slate-200">Content data:</span> What you add to the Platform:
                debate arguments and votes, discussion posts, comments, documents and files, events and whether
                you&apos;re attending, tasks, projects and poll ballots. For a formal ballot we also keep the roll of who
                was eligible to vote, and its certificate names who certified it and its scrutineers; it shows totals,
                never how anyone voted.
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
                <span className="font-semibold text-slate-200">Plan and payment data:</span> Your plan, the
                Societies you own, and how much of your plan&apos;s storage, AI and call time they use, so we can apply its
                limits and warn you near them. If you take a paid plan, Stripe collects your card and billing details;
                we give Stripe your username and, if you&apos;ve given one, your email address, and receive back only the
                plan, its status and a Stripe customer reference. We send ourselves a short notice when a plan starts or
                changes.
              </li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Data">
            <p>We use your personal data to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide and operate the Platform.</li>
              <li>Authenticate you and maintain session security.</li>
              <li>Associate your contributions with your account.</li>
              <li>Apply your plan&apos;s limits, take payments, and tell you about your plan and its limits.</li>
              <li>Respond to enquiries, contact form submissions and complaints.</li>
              <li>Keep users safe, and meet our legal duties, including under the Online Safety Act 2023. This
                includes checking text and uploaded images automatically, on our own server. If an image is refused as
                sexually explicit, we hold it encrypted, readable only by our team, for up to 30 days so we can check it,
                then delete it, with a record of the refusal (who, when, where and the file name). If it is child sexual
                abuse material, the law requires us to report it to the National Crime Agency and keep it for a year.</li>
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
              <li><span className="text-slate-200 font-medium">Legal obligation:</span> To handle reports of illegal and harmful content under the Online Safety Act 2023, to keep
                tax and payment records, and to respond to lawful requests from the police or courts.</li>
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
              <li><span className="text-slate-200 font-medium">Plans:</span> if a paid plan ends, your Societies are
                kept (some read-only) rather than deleted, until you or their Society Admins close them.</li>
              <li><span className="text-slate-200 font-medium">Backups:</span> we keep encrypted nightly backups for
                up to 90 days, so something deleted from the live site can remain in a backup until that backup
                expires. Backups are used only to restore the service.</li>
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
              <li>Data portability: receive your data in a reusable format.</li>
            </ul>
            <p>
              You can do much of this yourself on the <Link href="/my-data" className="text-blue-400 hover:underline">Your
              data</Link> page: download everything you&apos;ve added, as readable files, and delete your account. Deleting
              your account erases your personal details; what you posted in Societies stays as part of their record,
              under an anonymous name. Society Admins can also download their Society&apos;s data.
            </p>
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
              No method of data transmission is 100% secure; we cannot guarantee absolute security. Our{' '}
              <Link href="/security" className="text-blue-400 hover:underline">Security page</Link> explains how to report a
              vulnerability.
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
            <p id="processors" className="scroll-mt-20">These organisations process personal data for us, under data processing terms:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><span className="text-slate-200 font-medium">Contabo GmbH</span> (servers in France): hosts our
                servers, including calls, abuse scanning and the news service, and stores our encrypted backups.</li>
              <li><span className="text-slate-200 font-medium">Cloudflare</span> (USA, worldwide network): all traffic to
                new.vote passes through it, for encryption and protection from attacks.</li>
              <li><span className="text-slate-200 font-medium">Postmark</span> (AC PM LLC, part of ActiveCampaign, USA):
                delivers emails.</li>
              <li><span className="text-slate-200 font-medium">Anthropic</span> (Anthropic Ireland; processing in the
                USA): runs AI features for Societies that use new.vote&apos;s AI.</li>
              <li><span className="text-slate-200 font-medium">Stripe</span> (UK, EU and USA): takes payments for paid
                plans. For card and billing details, Stripe is also a controller in its own right, under its own
                privacy policy.</li>
              <li><span className="text-slate-200 font-medium">Purelymail</span> (USA): hosts our email inboxes, so it
                holds messages you send to us.</li>
              <li><span className="text-slate-200 font-medium">Browser push services</span> (Google, Mozilla, Apple):
                deliver notifications to your device, if you turn them on. The notifications are encrypted so these
                services can&apos;t read them.</li>
            </ul>
            <p>
              Some of these are in the United States, so using them transfers data outside the UK. These transfers rely
              on the UK Extension to the EU–US Data Privacy Framework, where the provider is certified (Cloudflare,
              Postmark and Stripe are), or on the safeguards in the provider&apos;s data processing terms (the EU Standard
              Contractual Clauses with the UK Addendum).
            </p>
            <p>
              When a formal ballot is certified, we send a fingerprint (a hash) of its certificate to FreeTSA, a
              timestamping service in Germany, so anyone can check later that the result hasn&apos;t changed. The
              fingerprint contains no personal data.
            </p>
          </Section>

          <Section title="11. Children">
            <p>
              If you are 16 or 17, <Link href="/young-people" className="text-blue-400 hover:underline">new.vote for young
              people</Link> explains this policy in plain words. You must be 16 or over to use new.vote, and you tell us your
              age group when you register. If you believe
              a child under 16 has an account, contact us and we will close it.
            </p>
            <p>
              If you are under 18, we use your age group to protect you: Society Admins see an &quot;Under 18&quot;
              marker (not your exact age group), you aren&apos;t named on a Society&apos;s public pages, reports
              involving you are reviewed first.
            </p>
            <p>
              <span className="font-semibold text-slate-200">Age checks.</span> Some features, such as joining a local
              Society, need your age confirmed. You can prove it with a digital wallet, sharing only yes/no answers such as
              &quot;over 18&quot;, which we check on our own server; or with a face check that runs on your own device, so
              your face never leaves it and the provider sends us only a signed result. We keep only your age group, how it
              was checked, and the date: never a selfie, an ID document or the wallet&apos;s answer.
            </p>
            <p>
              <span className="font-semibold text-slate-200">Checking ages.</span> To keep under-16s off new.vote and
              protect 16 and 17-year-olds, we run fixed, published rules over what members write (not sealed content, which
              we can&apos;t read): for example, someone saying they are 14, or mentioning a school year. We also count changes
              to your age group. These only decide whether we look more closely or ask you to confirm your age; they never
              decide anything on their own, except that someone saying they are under 16 has their account put on hold
              while our team looks at it. We keep only which rule matched and when, never the words.
            </p>
            <p>
              16 and 17-year-olds may use new.vote, so we design it to be safe for them by default, following the ICO&apos;s
              Children&apos;s Code: we show no adverts, don&apos;t track you across other sites, don&apos;t profile you for
              marketing, don&apos;t collect your location, and don&apos;t require your real name or an email address. You
              choose which Societies to join. What you post in a public Society can be seen by anyone (though we ask AI companies not to
              train on it), so we show usernames, not real names; in a private Society, only its members see it. We don&apos;t sell or share
              anyone&apos;s data for marketing. Paid plans are for people aged 18 or over.
            </p>
          </Section>

          <Section title="12. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will change the date at the top of this page
              and, for significant changes, tell account holders on the Platform before they take effect.
            </p>
          </Section>

        </div>
      </div>
    </div>
  );
}
