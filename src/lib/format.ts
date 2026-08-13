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