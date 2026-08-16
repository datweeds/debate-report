'use client';

import { useState } from 'react';

export type FooterModal = 'about' | 'terms' | 'privacy' | 'contact' | null;

type Props = {
  modal: FooterModal;
  onClose: () => void;
};

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl flex flex-col rounded-2xl border border-slate-700 bg-[#0c1322] shadow-2xl" style={{ maxHeight: '85vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold text-slate-200 mb-2">{title}</h3>
      <div className="space-y-2 text-sm text-slate-400 leading-relaxed">{children}</div>
    </div>
  );
}

// ── About ─────────────────────────────────────────────────────────────────────

function AboutContent() {
  return (
    <div className="space-y-1">
      <Section title="Our Mission">
        <p>
          new.vote is a structured debate and democratic engagement platform designed to raise the quality of
          public discourse. We believe that good arguments should be visible, traceable and judged on their
          merits — not on how loudly they are shouted. Our platform presents debates as structured argument
          graphs: claims supported by warrants, warrants backed by evidence, and rebuttals that challenge each
          step of the chain.
        </p>
      </Section>
      <Section title="Why Structured Debate?">
        <p>
          Most online debate is chaotic. Arguments get buried, context is lost and participants talk past each
          other. Structured debate changes this by requiring each contribution to declare what it is — a claim,
          a warrant, a piece of evidence, a rebuttal or a turn — and what it is arguing for or against.
        </p>
        <p>
          The result is a visual graph that any reader can follow from top to bottom, understanding exactly how
          each argument supports or challenges the central resolution.
        </p>
      </Section>
      <Section title="Statement Types">
        <div className="space-y-2.5 mt-1">
          {[
            { label: 'Resolution',  colour: 'text-amber-300',   desc: 'The central proposition set by moderators — the root of the argument graph.' },
            { label: 'Framework',   colour: 'text-sky-300',     desc: 'A core principle or value that frames how the resolution should be evaluated.' },
            { label: 'Claim',       colour: 'text-slate-300',   desc: 'A direct argument for or against the resolution.' },
            { label: 'Warrant',     colour: 'text-violet-300',  desc: 'The reasoning that explains why a claim holds.' },
            { label: 'Evidence',    colour: 'text-emerald-300', desc: 'A cited fact, study, statistic or source.' },
            { label: 'Impact',      colour: 'text-orange-300',  desc: 'The significance or real-world consequence of winning the argument.' },
            { label: 'Rebuttal',    colour: 'text-rose-300',    desc: 'A direct challenge to an existing statement.' },
            { label: 'Turn',        colour: 'text-fuchsia-300', desc: 'Shows the opposing argument actually supports your side.' },
          ].map(s => (
            <div key={s.label} className="flex gap-3">
              <span className={`text-xs font-bold w-20 flex-shrink-0 pt-0.5 ${s.colour}`}>{s.label}</span>
              <span className="text-xs text-slate-400 leading-relaxed">{s.desc}</span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Our Principles">
        <ul className="space-y-1.5 list-disc pl-4">
          <li>Arguments are judged on logic and evidence, not on who made them.</li>
          <li>Both sides of every debate are represented and weighted fairly.</li>
          <li>Sources must be cited; unsupported assertions are not permitted.</li>
          <li>Personal attacks, misinformation and bad-faith participation are removed.</li>
        </ul>
      </Section>
    </div>
  );
}

// ── Terms ─────────────────────────────────────────────────────────────────────

function TermsContent() {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-5">Last updated: July 2026</p>
      <Section title="1. Acceptance of Terms">
        <p>By accessing or using new.vote you agree to be bound by these Terms. If you do not agree, please do not use the platform. We reserve the right to update these terms at any time.</p>
      </Section>
      <Section title="2. User Accounts">
        <p>You must create an account to participate. You are responsible for maintaining the confidentiality of your credentials and for all activity under your account. We reserve the right to suspend accounts that violate these terms.</p>
      </Section>
      <Section title="3. User-Generated Content">
        <p>By submitting content you grant new.vote a non-exclusive, royalty-free, worldwide licence to display and distribute that content within the platform. You warrant that your content does not infringe third-party rights, is not false or defamatory, and complies with our community standards.</p>
      </Section>
      <Section title="4. Moderation">
        <p>All contributions are subject to moderator review before publication. We reserve the right to reject or remove any content that does not meet our quality standards, without obligation to provide reasons.</p>
      </Section>
      <Section title="5. Prohibited Conduct">
        <p>You agree not to: submit false or deliberately misleading content; harass or abuse other users; attempt to manipulate voting or engagement metrics; use the platform for commercial advertising without consent; impersonate any person or entity.</p>
      </Section>
      <Section title="6. Intellectual Property">
        <p>Platform software, design, and branding are the intellectual property of new.vote. User-submitted content remains the property of the respective authors.</p>
      </Section>
      <Section title="7. Limitation of Liability">
        <p>The platform is provided &quot;as is&quot; without warranties of any kind. To the maximum extent permitted by law, new.vote shall not be liable for any indirect, incidental, or consequential damages.</p>
      </Section>
      <Section title="8. Governing Law">
        <p>These terms are governed by the laws of England and Wales.</p>
      </Section>
    </div>
  );
}

// ── Privacy ───────────────────────────────────────────────────────────────────

function PrivacyContent() {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-5">Last updated: July 2026</p>
      <Section title="1. Who We Are">
        <p>new.vote is a structured debate and democratic engagement platform. &quot;We&quot;, &quot;us&quot; and &quot;our&quot; refer to the operators of new.vote.</p>
      </Section>
      <Section title="2. Data We Collect">
        <ul className="list-disc pl-4 space-y-1.5">
          <li><span className="text-slate-200 font-medium">Account data:</span> Username, email address (if provided), and account tier.</li>
          <li><span className="text-slate-200 font-medium">Content data:</span> Statements, votes and other contributions you submit.</li>
          <li><span className="text-slate-200 font-medium">Authentication data:</span> Passkey credentials stored as cryptographic keys — never plaintext passwords.</li>
          <li><span className="text-slate-200 font-medium">Usage data:</span> Pages visited and session information for security and performance.</li>
          <li><span className="text-slate-200 font-medium">Contact data:</span> Name, email and message if you contact us.</li>
        </ul>
      </Section>
      <Section title="3. How We Use Your Data">
        <p>We use your data to provide and operate the platform, authenticate you, associate contributions with your account, respond to enquiries, and prevent abuse. We do not sell or share your data with third parties for marketing purposes.</p>
      </Section>
      <Section title="4. Cookies">
        <p>We use a session cookie (<code className="rounded bg-slate-800 px-1 text-xs text-blue-300">nv_session</code>) to maintain your authenticated session. We also use <code className="rounded bg-slate-800 px-1 text-xs text-blue-300">localStorage</code> to remember your theme preference. No tracking or advertising cookies are used.</p>
      </Section>
      <Section title="5. Your Rights">
        <p>Under applicable data protection law you have the right to access, correct, or request deletion of your personal data, and to object to or restrict processing. To exercise any of these rights please contact us. We will respond within 30 days.</p>
      </Section>
      <Section title="6. Data Retention">
        <p>Account data is retained while your account is active. Content may remain visible after account deletion, attributed to an anonymised identifier.</p>
      </Section>
      <Section title="7. Security">
        <p>We implement appropriate technical and organisational measures to protect your data, including encrypted session tokens and access controls.</p>
      </Section>
    </div>
  );
}

// ── Contact form ──────────────────────────────────────────────────────────────

function ContactContent({ onClose }: { onClose: () => void }) {
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return; }
      setSent(true);
    } catch {
      setError('Could not send message. Please try again.');
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center py-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
          <svg className="h-7 w-7 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-slate-100 mb-2">Message sent!</h3>
        <p className="text-slate-400 text-sm mb-5">Thank you for getting in touch. We&apos;ll get back to you as soon as possible.</p>
        <button onClick={onClose} className="text-sm text-blue-400 hover:underline">Close</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-400 mb-1">Questions, suggestions, or concerns? We&apos;d love to hear from you.</p>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{error}</div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text" required value={name} onChange={e => setName(e.target.value)} maxLength={100}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Your name"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">
            Email <span className="text-red-400">*</span>
          </label>
          <input
            type="email" required value={email} onChange={e => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="you@example.com"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">
          Subject <span className="text-red-400">*</span>
        </label>
        <input
          type="text" required value={subject} onChange={e => setSubject(e.target.value)} maxLength={200}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="What is your message about?"
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">
          Message <span className="text-red-400">*</span>
        </label>
        <textarea
          required value={message} onChange={e => setMessage(e.target.value)} rows={5} maxLength={5000}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          placeholder="Tell us what's on your mind…"
        />
        <p className="mt-1 text-right text-xs text-slate-600">{message.length}/5000</p>
      </div>

      <button
        type="submit" disabled={sending}
        className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
      >
        {sending ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function FooterModals({ modal, onClose }: Props) {
  if (!modal) return null;

  const titles: Record<NonNullable<FooterModal>, string> = {
    about:   'About new.vote',
    terms:   'Terms & Conditions',
    privacy: 'Privacy Policy',
    contact: 'Contact Us',
  };

  return (
    <Shell title={titles[modal]} onClose={onClose}>
      {modal === 'about'   && <AboutContent />}
      {modal === 'terms'   && <TermsContent />}
      {modal === 'privacy' && <PrivacyContent />}
      {modal === 'contact' && <ContactContent onClose={onClose} />}
    </Shell>
  );
}
