// new.vote shield+tick logo — inline SVG, no external deps, renders at any size
export function NvLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 44" fill="none" aria-hidden="true">
      {/* Shield */}
      <path
        d="M20 2 L36 9 L36 27 Q36 39 20 43 Q4 39 4 27 L4 9 Z"
        fill="#2563eb"
      />
      {/* Inner highlight */}
      <path
        d="M20 6 L33 12 L33 27 Q33 37 20 40 Q7 37 7 27 L7 12 Z"
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="1"
      />
      {/* Bold checkmark */}
      <path
        d="M12 23 L17.5 29.5 L29 14"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
