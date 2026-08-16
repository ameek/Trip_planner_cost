const CURRENCY_SYMBOLS: Record<string, string> = {
  BDT: '৳',
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  JPY: '¥',
  CNY: '¥',
  CAD: 'CA$',
  AUD: 'A$',
  SGD: 'S$',
  THB: '฿',
  MYR: 'RM',
  IDR: 'Rp',
  NPR: 'रू',
  LKR: 'Rs',
  PKR: 'Rs',
  AED: 'د.إ',
}

export function formatMoney(amount: number, currency = 'BDT'): string {
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] ?? `${currency} `
  const abs = Math.abs(amount)
  const decimals = Number.isInteger(abs) ? 0 : 2
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${amount < 0 ? '-' : ''}${symbol}${formatted}`
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Math.max(0, Date.now() - timestamp)
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}