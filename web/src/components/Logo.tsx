/** Brand mark: a tall screenshot strip turning into lines of text. */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <rect x="6.5" y="5" width="8.5" height="22" rx="2.2" fill="#fff" />
      <rect x="8.6" y="8" width="4.3" height="1.5" rx=".75" fill="var(--accent)" opacity=".45" />
      <rect x="8.6" y="11.2" width="3.2" height="1.5" rx=".75" fill="var(--accent)" opacity=".45" />
      <rect x="8.6" y="14.4" width="4.3" height="1.5" rx=".75" fill="var(--accent)" opacity=".45" />
      <path d="M18.5 11h7M18.5 16h7M18.5 21h4.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight text-ink">
        Long<span className="text-accent">2</span>Text
      </span>
    </span>
  );
}
