import type { LedgerEntry, Member, SplitMode } from './types'

export interface Balance {
  member: Member
  balance: number
}

export interface Settlement {
  from: Member
  to: Member
  amount: number
}

const EPS = 0.005

export { EPS }

export function computeBalances(
  entries: LedgerEntry[],
  members: Member[],
  splitMode: SplitMode,
): Balance[] {
  const paid = new Map<string, number>(members.map((m) => [m.id, 0]))
  const owed = new Map<string, number>(members.map((m) => [m.id, 0]))
  const allIds = members.map((m) => m.id)

  for (const entry of entries) {
    const participants =
      entry.split_between && entry.split_between.length > 0 ? entry.split_between : allIds
    const share = entry.amount / participants.length
    for (const pid of participants) {
      owed.set(pid, (owed.get(pid) ?? 0) + share)
    }
    if (entry.paid_by) {
      paid.set(entry.paid_by, (paid.get(entry.paid_by) ?? 0) + entry.amount)
    }
  }

  return members.map((member) => {
    const p = paid.get(member.id) ?? 0
    const o = owed.get(member.id) ?? 0
    const balance = splitMode === 'fixed' ? p - (member.fixed_contribution ?? 0) : p - o
    return { member, balance }
  })
}

export function minimumSettlements(balances: Balance[]): Settlement[] {
  const debtors = balances
    .filter((b) => b.balance < -EPS)
    .map((b) => ({ member: b.member, amount: -b.balance }))
  const creditors = balances
    .filter((b) => b.balance > EPS)
    .map((b) => ({ member: b.member, amount: b.balance }))

  debtors.sort((a, b) => b.amount - a.amount)
  creditors.sort((a, b) => b.amount - a.amount)

  const result: Settlement[] = []
  let di = 0
  let ci = 0
  while (di < debtors.length && ci < creditors.length) {
    const amount = Math.min(debtors[di].amount, creditors[ci].amount)
    if (amount > EPS) {
      result.push({ from: debtors[di].member, to: creditors[ci].member, amount: round2(amount) })
    }
    debtors[di].amount -= amount
    creditors[ci].amount -= amount
    if (debtors[di].amount <= EPS) di++
    if (creditors[ci].amount <= EPS) ci++
  }
  return result
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}