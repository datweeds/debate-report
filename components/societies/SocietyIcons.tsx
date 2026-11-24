// A private Society's padlock and an owner's key, drawn in the text colour so each
// place can colour them: light blue in the left menu, yellow everywhere else.
export function LockIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path strokeLinecap="round" d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
export function KeyIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.7 12.3 20 3m-3 3 2.5 2.5M14.5 8.5 17 11" />
    </svg>
  );
}
