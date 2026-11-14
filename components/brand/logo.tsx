/** The Atesta mark: a white check on a blue rounded square. */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="#2F54EB" />
      <path
        d="M9.5 16.5l4.2 4.2 8.8-9.4"
        fill="none"
        stroke="#fff"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Mark and wordmark together. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="font-display text-subhead font-extrabold tracking-[-0.03em] text-ink">
        Atesta
      </span>
    </span>
  );
}
