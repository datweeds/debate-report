import Link from 'next/link';

// Shown on the demo Society: everything here is open, so visitors can explore
export default function DemoBanner({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
      <span>
        <strong>Demo Society.</strong> Everything here, including its discussions and projects, is open to explore, even without an account.
        Real Societies can be private and encrypted.
      </span>
      {!loggedIn && <Link href="/pricing" className="rounded-md border border-amber-400/50 px-2 py-0.5 font-semibold hover:bg-amber-500/20">Sign up to take part</Link>}
    </div>
  );
}
