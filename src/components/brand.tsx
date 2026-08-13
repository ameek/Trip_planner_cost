export function TrailmarkMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="4" fill="#1c2b21" />
      <circle cx="10" cy="10" r="3" fill="#f7f3e8" />
      <circle cx="16" cy="18" r="3" fill="#2b3a54" stroke="#f7f3e8" strokeWidth="1.5" />
      <circle cx="22" cy="26" r="3" fill="#b5652d" />
    </svg>
  )
}

export function LockIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="3.5" y="7" width="9" height="7" rx="1.5" />
      <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" />
    </svg>
  )
}

export function LockOpenIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="3.5" y="7" width="9" height="7" rx="1.5" />
      <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" opacity="0.35" />
    </svg>
  )
}