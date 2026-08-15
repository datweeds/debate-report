export function DrLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 44 26" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="19" height="15" rx="4" fill="#3b82f6" />
      <polygon points="4,16 4,24 12,16" fill="#3b82f6" />
      <rect x="24" y="1" width="19" height="15" rx="4" fill="#3b82f6" opacity="0.62" />
      <polygon points="39,16 39,24 31,16" fill="#3b82f6" opacity="0.62" />
    </svg>
  );
}
