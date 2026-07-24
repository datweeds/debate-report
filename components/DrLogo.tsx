export function DrLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      {/* Left bubble — blue: one side of the debate */}
      <rect x="1" y="2" width="24" height="17" rx="4" fill="#60a5fa" opacity="0.9" />
      <polygon points="6,19 6,25 13,19" fill="#60a5fa" opacity="0.9" />
      {/* Right bubble — gold: opposing side */}
      <rect x="15" y="18" width="24" height="17" rx="4" fill="#fbbf24" />
      <polygon points="34,35 34,41 27,35" fill="#fbbf24" />
    </svg>
  );
}
