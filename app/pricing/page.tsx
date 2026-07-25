import Link from 'next/link';

const TIERS = [
  {
    id: 'family',
    name: 'Family',
    price: 'Free',
    priceNote: 'forever',
    color: 'emerald',
    gradient: 'text-gradient-emerald',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    btn: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    features: [
      'One open debate at a time',
      'Up to 6 participants per debate',
      'Create and moderate your debates',
      'All family members participate free',
      'Full voting and chat',
    ],
    note: 'Great for families, book clubs, small groups',
  },
  {
    id: 'debater',
    name: 'Public Debater',
    price: '£4.99',
    priceNote: 'per month',
    color: 'blue',
    gradient: 'text-gradient-blue',
    border: 'border-blue-500/30',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    btn: 'bg-blue-600 hover:bg-blue-500 text-white',
    features: [
      'Participate in unlimited public debates',
      'Create statements in any public debate',
      'Full voting and chat',
      'Unlimited participants',
      'Profile and debate history',
    ],
    note: 'For individuals who want to engage fully',
    highlight: true,
  },
  {
    id: 'moderator',
    name: 'Moderator',
    price: '£9.99',
    priceNote: 'per month',
    color: 'amber',
    gradient: 'text-gradient-gold',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    btn: 'bg-amber-600 hover:bg-amber-500 text-white',
    features: [
      'Create unlimited debates',
      'Full moderation controls',
      'All Public Debater rights',
      'Invite participants to debates',
      'Moderator dashboard',
    ],
    note: 'For educators, journalists, organisations',
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-dr-base py-16 px-4 sm:px-6">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-700/30 bg-blue-500/10 px-4 py-1.5 text-xs font-medium text-blue-300 tracking-wide uppercase">
            Transparent pricing
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-50 mb-4">
            Choose how you debate
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto">
            Start free with the Family tier. Upgrade when you need more.
            Payment wired soon — register now and your tier is reserved.
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Want to debate without sharing personal data?{' '}
            <Link href="/register?tier=family&incognito=true" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
              Register incognito
            </Link>{' '}
            — no email required.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {TIERS.map(tier => (
            <div
              key={tier.id}
              className={`card-dr relative flex flex-col p-6 ${tier.highlight ? 'border-blue-500/40 shadow-lg shadow-blue-500/10' : ''}`}
            >
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white">
                    Most popular
                  </span>
                </div>
              )}

              <div className={`inline-flex self-start items-center rounded-full border px-2.5 py-0.5 text-xs font-medium mb-4 ${tier.badge}`}>
                {tier.name}
              </div>

              <div className="mb-1">
                <span className={`text-3xl font-extrabold ${tier.gradient}`}>{tier.price}</span>
                <span className="text-slate-500 text-sm ml-1">/{tier.priceNote}</span>
              </div>
              <p className="text-xs text-slate-500 mb-5">{tier.note}</p>

              <ul className="space-y-2.5 mb-6 flex-1">
                {tier.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                    <svg className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={`/register?tier=${tier.id}`}
                className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-center transition-colors ${tier.btn}`}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>

        {/* Incognito note */}
        <div className="card-dr p-6 text-center">
          <h2 className="text-sm font-semibold text-slate-200 mb-1">Debate incognito</h2>
          <p className="text-xs text-slate-500 max-w-lg mx-auto mb-3">
            All tiers support anonymous registration. Choose a username, skip the email, and
            we&apos;ll generate a private access code. No personal data is stored.
            Keep your access code safe — it&apos;s your only way back in.
          </p>
          <Link
            href="/register?incognito=true"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-4 py-2 text-xs font-medium text-slate-300 hover:border-slate-500 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 0 1 21.75 8.25Z" />
            </svg>
            Register incognito
          </Link>
        </div>

      </div>
    </div>
  );
}
