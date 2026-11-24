import type { Metadata } from 'next';
import Link from 'next/link';
import PricingActions from '@/components/pricing/PricingActions';
import { PLANS, enforcementOn, formatBytes, plansOnSale, type PlanKey } from '@/lib/plans';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'One price for the whole group, never per member. Pod is free; Team £4 a month; Network £9 a month.',
};

// Plans and limits come from lib/plans.ts, so this page always matches what the
// server enforces. Prices are charged through Stripe (set up there).

const TAGLINE: Record<PlanKey, string> = {
  free: 'For small, informal or short-lived groups',
  society: 'For groups that keep going',
  society_plus: 'For groups that make formal decisions',
};
const HIGHLIGHTS: Record<PlanKey, string[]> = {
  free: ['Up to 3 Societies, free', 'Unlimited members', '500 MB of storage, shared', 'Video calls up to 30 minutes, 10 people', 'Live AI quality checks on debates', 'Everything in “On every plan” below'],
  society: ['Everything in Pod', 'Up to 10 Societies', '5 GB of storage, shared', 'Video calls up to 90 minutes, 25 people', 'Debate Quality Reports and the AI helper', 'Voting codes for people without an account', 'Repeating events'],
  society_plus: ['Everything in Team', 'Up to 25 Societies', '15 GB of storage, shared', 'Video calls of any length, 50 people', 'Three times the AI allowance', 'Formal ballots for AGMs and elections, with a certified result', 'Email support within 2 working days'],
};

const ORDER: PlanKey[] = ['free', 'society', 'society_plus'];
const yes = '✓', no = '—';
const ROWS: [string, (k: PlanKey) => string][] = [
  ['Societies you can run', k => `Up to ${PLANS[k].limits.societies}`],
  ['Members', () => 'Unlimited'],
  ['Storage, shared across your Societies', k => formatBytes(PLANS[k].limits.storageBytes)],
  ['Largest file', k => formatBytes(PLANS[k].limits.maxFileBytes)],
  ['Video calls (Meet)', k => { const l = PLANS[k].limits; return `${l.meetMinutes ? `${l.meetMinutes} min` : 'Any length'}, ${l.meetParticipants} people`; }],
  ['Live AI quality checks, shared', k => `About ${(Math.round(PLANS[k].limits.aiUsdMonth / 0.0009 / 50) * 50).toLocaleString('en-GB')} a month`],
  ['Debate Quality Reports and AI helper', k => (PLANS[k].limits.aiStandard ? `About ${Math.round(PLANS[k].limits.aiUsdMonth / 0.12)} a month` : no)],
  ['Your own AI provider', () => 'Unlimited'],
  ['Voting codes for people without an account', k => (PLANS[k].limits.votingCodes ? yes : no)],
  ['Repeating events', k => (PLANS[k].limits.recurringEvents ? yes : no)],
  ['Formal ballots, certified results', k => (PLANS[k].limits.formalBallots ? yes : no)],
  ['Support', k => PLANS[k].limits.support],
];

// Your own server (with federation, coming 2027): no limits from us; paid add-ons for what costs us to run
const SELF: Record<string, string> = {
  'Societies you can run': 'Unlimited',
  'Members': 'Unlimited',
  'Storage, shared across your Societies': 'Your server',
  'Largest file': 'You decide',
  'Video calls (Meet)': 'Your server',
  'Live AI quality checks, shared': 'Your AI, or our AI add-on',
  'Debate Quality Reports and AI helper': 'Your AI, or our AI add-on',
  'Your own AI provider': 'Unlimited',
  'Voting codes for people without an account': '✓',
  'Repeating events': '✓',
  'Formal ballots, certified results': '✓',
  'Support': 'Community; support plans for organisations',
};

const ADDONS = [
  ['AI', 'Quality checks, Debate Quality Reports and the AI helper on new.vote’s AI, for servers without an AI account of their own. Pay for what you use, with a cap you set.'],
  ['News', 'Your Societies’ News, gathered from many sources and summarised, delivered to your server: no news pipeline to run.'],
  ['Safety scanning', 'The same image and text scanning as new.vote, for new posts and uploads, with alerts to your Society Admins: help with your Online Safety Act duties.'],
  ['Age assurance', 'Age checks for your server without a contract of your own: wallet proofs checked against an up-to-date list of trusted issuers, and a certified face check that runs on members’ own devices, with our updated age-signal rules.'],
  ['Safety review desk', 'Trained people to review age concerns, age reviews and urgent reports for your server, within an agreed response time.'],
  ['Encrypted backups', 'Nightly, encrypted, off-site copies of your server, kept for up to 90 days. Only you hold the key.'],
  ['Support', 'Help with installing, upgrading and running your server, for organisations that need an agreed response time.'],
];

const EVERY_PLAN = [
  'Debates and argument maps, with For and Against votes',
  'Polls: secret or named ballots, ranked choice, quizzes, live meeting mode',
  'Private Societies, encrypted on our server',
  'Sealed items, encrypted in members’ browsers',
  'Discussions, documents, notes and share links',
  'Events calendar with a feed for your own calendar',
  'Projects, tasks and a risk log',
  'Principles your members can discuss and amend',
  'News for your Society’s topics',
  'Analytics, and a full export of everything, any time',
  'Safety built in: image and text scanning, reporting, appeals',
  'Child safety: 16+ sign-up, protections for 16 and 17-year-olds, no private messages, age concerns with outcomes, and age checks for local Societies at no cost to you',
];

const TRUST = [
  ['Secret ballots stay secret', 'Who voted is kept apart from how they voted. Not even the poll’s Society Admins can link a ballot to a person, yet everyone can still change their vote until the poll closes.'],
  ['Every ballot is encrypted', 'Ballots are stored encrypted in every Society, public or private. Only counts are shown, never a single person’s choice in a secret poll.'],
  ['A receipt for every voter', 'Each voter gets a receipt. After the poll, they can find it in the published list of counted ballots and know their vote was counted, without revealing how they voted.'],
  ['An accuracy check you can run', 'One click recounts the poll independently: voters match ballots, nobody has two counted ballots, every receipt is unique, and the recount matches the result.'],
  ['Votes without an account', 'On paid plans, hand out single-use voting codes by email, text or on paper. We keep only a scrambled copy of each code, so a leaked database can’t be used to vote.'],
  ['Formal ballots', 'For AGMs, elections and constitutional votes (Network): a voter roll fixed when voting opens, a quorum and majority rule, scrutineers, and a certified result with an independent timestamp, so anyone can later show it hasn’t changed.'],
];

const FAQ = [
  ['What is a Society?', 'A Society is your group on new.vote: its members, debates, polls, documents, events and calls. Your plan covers every Society you run, with storage and AI shared across them. You never pay per member, so adding people is always free.'],
  ['Why charge at all?', 'Storage, AI and video calls cost us money each month, so that is what the plans cover. Privacy and encryption are on every plan, never a paid extra, and we never show ads or sell data.'],
  ['When does billing start?', 'The day you choose a paid plan. You pay in advance, monthly or yearly, through Stripe, and the plan renews until you downgrade. If prices change, we tell you at least 30 days before your next payment. Taking a plan as a consumer? Cancel within 14 days of your first payment for a full refund. Details are in the Terms, section 9.'],
  ['What happens if we stop paying?', 'Your plan carries on for 30 days, then moves to Pod. If you run more than 3 Societies, you choose which stay active; the rest become read-only. Nothing is deleted: everything stays readable and exportable, and you can pick up a paid plan again at any time.'],
  ['What if I lose access to my account?', 'Sign in with your recovery code, or a passkey on another device. If you signed up with only a username and lose both your passkey and your recovery code, we can’t restore the account, so keep the code somewhere safe. Society Admins: add a second admin, so a Society never depends on one account.'],
  ['Do we pay for child safety or age checks?', 'No. Every child safety protection is on every plan, Pod included, and age checks cost you and your members nothing. We pay for them, and they’re only used when needed, such as joining a local Society.'],
  ['Can we use our own AI?', 'Yes, on every plan. Connect your own AI provider in your Society’s settings and you pay it directly, with no limit from us.'],
  ['Discounts?', 'Pay yearly and get two months free. Charities, community groups and student societies: contact us for a discount.'],
  ['Can we run it ourselves?', 'From 2027, yes: on your own server, free, connected to new.vote. Your identity is yours, so no server can lock you out. Add AI, News, safety scanning, age checks, a safety review desk or backups from us if you want them. See “Run new.vote on your own server” below.'],
  ['One AGM a year?', 'Take Network for the month of your AGM, then downgrade. Your Societies keep everything they made.'],
];

export default async function PricingPage() {
  const [onSale, enforced] = await Promise.all([plansOnSale(), enforcementOn()]);
  return (
    <div className="px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-slate-100 sm:text-4xl">One price for the whole group. Never per member.</h1>
          <p className="mx-auto mt-3 max-w-2xl text-slate-400">
            Joining, voting and debating are always free. Run up to 3 Societies free.
            Need more? One plan covers them all.
          </p>
          {!onSale && (
            <p className="mx-auto mt-5 max-w-2xl rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-200">
              Paid plans aren’t on sale yet.{!enforced && ' Until they are, every Society can use everything without limits.'}
            </p>
          )}
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {ORDER.map(k => (
            <div key={k} className={`card-dr flex flex-col p-6 ${k === 'society' ? 'border-emerald-500/40' : ''}`}>
              <p className={`text-sm font-semibold uppercase tracking-widest ${k === 'free' ? 'text-blue-300' : k === 'society' ? 'text-emerald-300' : 'text-amber-300'}`}>{PLANS[k].name}</p>
              <p className="mt-2 text-4xl font-bold text-slate-100">
                {PLANS[k].month ? <>£{PLANS[k].month}<span className="text-base font-medium text-slate-400"> / month</span></> : 'Free'}
              </p>
              <p className="mt-1 text-xs text-slate-500">{PLANS[k].year ? `or £${PLANS[k].year} a year` : 'for ever'}</p>
              <p className="mt-3 text-sm text-slate-300">{TAGLINE[k]}</p>
              <ul className="mt-5 flex-1 space-y-2">
                {HIGHLIGHTS[k].map(f => (
                  <li key={f} className="flex gap-2 text-sm text-slate-300">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                    {f}
                  </li>
                ))}
              </ul>
              <PricingActions kind={k} onSale={onSale} />
            </div>
          ))}
          <div className="card-dr flex flex-col border-dashed border-violet-500/40 p-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-violet-300">Your own server</p>
            <p className="mt-2 text-4xl font-bold text-slate-100">Free</p>
            <p className="mt-1 text-xs text-slate-500">add-ons from us as you need them</p>
            <p className="mt-3 inline-block self-start rounded-full border border-violet-500/40 bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold text-violet-200">Coming 2027</p>
            <p className="mt-3 text-sm text-slate-300">For groups that want their data on their own hardware</p>
            <ul className="mt-5 flex-1 space-y-2">
              {['Run new.vote on your own server', 'Your identity is yours, not any server’s', 'No server admin can lock you out', 'Unlimited Societies, members and storage', 'Add AI, News, safety and age checks, or backups from us'].map(f => (
                <li key={f} className="flex gap-2 text-sm text-slate-300">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link href="#own-server" className="mt-6 inline-block w-full rounded-lg border border-violet-500/40 px-4 py-2.5 text-center text-sm font-semibold text-violet-200 hover:bg-violet-500/10">How it will work</Link>
          </div>
        </div>

        <div className="mt-14">
          <h2 className="mb-4 text-xl font-semibold text-slate-100">Compare plans</h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-900/60 text-slate-400">
                <tr><th className="px-4 py-3 font-medium" />{ORDER.map(k => <th key={k} className="px-4 py-3 font-semibold text-slate-200">{PLANS[k].name}</th>)}
                  <th className="px-4 py-3 font-semibold text-violet-200">Your own server <span className="block text-[11px] font-normal text-violet-300/80">coming 2027</span></th></tr>
              </thead>
              <tbody className="text-slate-300">
                {ROWS.map(([label, f]) => (
                  <tr key={label} className="border-t border-slate-800">
                    <td className="px-4 py-2.5 text-slate-400">{label}</td>
                    {ORDER.map(k => <td key={k} className="px-4 py-2.5">{f(k)}</td>)}
                    <td className="px-4 py-2.5 text-violet-100/90">{SELF[label] ?? '✓'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            AI figures are typical: a live quality check costs us about a tenth of a penny, a Quality Report about 10p. When your AI allowance
            runs out, features carry on without AI until the next month; nothing is blocked. Prices in GBP.
          </p>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="mb-4 text-xl font-semibold text-slate-100">On every plan, Pod included</h2>
            <ul className="space-y-2">
              {EVERY_PLAN.map(f => <li key={f} className="flex gap-2 text-sm text-slate-300"><span className="text-emerald-400">✓</span>{f}</li>)}
            </ul>
          </div>
          <div>
            <h2 className="mb-4 text-xl font-semibold text-slate-100">Questions</h2>
            <dl className="space-y-4">
              {FAQ.map(([q, a]) => <div key={q}><dt className="text-sm font-semibold text-slate-200">{q}</dt><dd className="mt-1 text-sm text-slate-400">{a}</dd></div>)}
            </dl>
          </div>
        </div>

        <div className="mt-14">
          <h2 className="text-xl font-semibold text-slate-100">Votes you can trust</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Most online polls stop double voting by email or IP address, which is easy to get round, and keep every vote readable by whoever runs them.
            new.vote polls are built to be easy to run and hard to cheat, on every plan.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TRUST.map(([t, d]) => (
              <div key={t} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <p className="text-sm font-semibold text-slate-100">{t}</p>
                <p className="mt-1 text-sm text-slate-400">{d}</p>
              </div>
            ))}
          </div>
        </div>

        <div id="own-server" className="mt-14 scroll-mt-20 rounded-2xl border border-violet-500/30 bg-violet-500/5 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">Coming 2027</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-100">Run new.vote on your own server</h2>
          <div className="mt-3 grid gap-6 md:grid-cols-2">
            <div className="space-y-3 text-sm text-slate-400">
              <p>
                new.vote is becoming a network of connected servers. Universities, unions, councils and co-ops will be able to run it on
                their own hardware, free, with their data kept on their own servers.
              </p>
              <p>
                <strong className="text-slate-200">You own your identity.</strong> Your account belongs to you, not to new.vote or to any server:
                you sign in with keys only you hold, and take your identity with you to any server in the network.
              </p>
              <p>
                <strong className="text-slate-200">No one can lock you out.</strong> If a server goes down, or its admin shuts you out, your identity
                still works everywhere else in the network, so you never lose access completely.
              </p>
              <p>
                <strong className="text-slate-200">Still one network.</strong> Your server connects to new.vote and to other servers, so people join
                Societies wherever they are, and take part in debates and polls across servers.
              </p>
              <p>
                <strong className="text-slate-200">No limits from us.</strong> Societies, members, storage and calls are limited only by your server.
                Every feature is included, formal ballots too.
              </p>
              <p>
                <strong className="text-slate-200">Open protocols.</strong> Servers will connect over open standards, so new.vote fits into the wider
                open web. We’re evaluating Secure-Net, a new protocol; ActivityPub, used by Mastodon and the fediverse; Matrix; the AT Protocol, used
                by Bluesky; and Nostr. We may support several, with bridges between them. No choice has been made yet.
              </p>
              <p>
                <strong className="text-slate-200">Move whenever you like.</strong> Start on new.vote today and take a Society to your own server
                later, everything included; or bring it back.
              </p>
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-200">Add-ons from new.vote, for what’s hard to run yourself</p>
              <dl className="space-y-3">
                {ADDONS.map(([t, d]) => (
                  <div key={t}><dt className="text-sm font-medium text-violet-200">{t}</dt><dd className="text-sm text-slate-400">{d}</dd></div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-slate-500">Add-on prices will be published before launch. Your server only tells us what an add-on needs; nothing else is reported.</p>
            </div>
          </div>
          <p className="mt-6 text-sm text-slate-400">
            Planning to run your own? <Link href="/contact" className="font-semibold text-blue-400 hover:underline">Tell us</Link> and we’ll keep you posted, and help you prepare.
          </p>
        </div>

        <p className="mt-14 text-center text-sm text-slate-500">
          Running something bigger, or need your own server? <Link href="/contact" className="text-blue-400 hover:underline">Talk to us</Link>.
        </p>
      </div>
    </div>
  );
}
