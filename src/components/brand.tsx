export function TrailmarkMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      <rect width="64" height="64" rx="14" fill="#1c2b21" />
      <rect width="64" height="64" rx="14" fill="url(#bg_gradient_brand)" opacity="0.4" />
      <circle cx="32" cy="32" r="22" stroke="#2a4032" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="17" stroke="#b5652d" strokeWidth="1.5" strokeDasharray="3 3" />
      <path d="M18 38L27 26L33 34L40 24L48 38H18Z" fill="#2b3a54" opacity="0.85" />
      <path d="M27 26L33 34L30 38H18L27 26Z" fill="#3a4d6e" opacity="0.5" />
      <path d="M22 42C26 42 26 36 32 36C38 36 38 28 44 24" stroke="#d97736" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M41 21L47 24L44 30" stroke="#d97736" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points="32,16 36,32 32,48 28,32" fill="url(#needle_grad_brand)" />
      <circle cx="32" cy="32" r="3.5" fill="#f7f3e8" stroke="#1c2b21" strokeWidth="1.5" />
      <circle cx="32" cy="12" r="1.5" fill="#e2b86b" />
      <circle cx="52" cy="32" r="1.5" fill="#e2b86b" />
      <circle cx="32" cy="52" r="1.5" fill="#e2b86b" />
      <circle cx="12" cy="32" r="1.5" fill="#e2b86b" />
      <defs>
        <linearGradient id="bg_gradient_brand" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2a4032" />
          <stop offset="1" stopColor="#0f1712" />
        </linearGradient>
        <linearGradient id="needle_grad_brand" x1="28" y1="16" x2="36" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e2b86b" />
          <stop offset="0.5" stopColor="#c49035" />
          <stop offset="1" stopColor="#b5652d" />
        </linearGradient>
      </defs>
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