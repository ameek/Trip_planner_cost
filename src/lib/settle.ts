import type { ExactShare, LedgerEntry, Member } from './types'

export interface Balance {
  member: Member
  target: number
  paid: number
  balance: number
}

export interface Settlement {
  from: Member
  to: Member
  amount: number
}

export const EPS = 0.005

export function computeBalances(
  entries: LedgerEntry[],
  members: Member[],
): Balance[] {
  const paid = new Map<string, number>(members.map((m) => [m.id, 0]))
  const owed = new Map<string, number>(members.map((m) => [m.id, 0]))
  const allIds = members.map((m) => m.id)

  for (const entry of entries) {
    for (const payer of entry.paid_by) {
      paid.set(payer.member_id, (paid.get(payer.member_id) ?? 0) + payer.amount)
    }
    if (entry.split_type === 'even') {
      const participants: string[] =
        entry.split_details.length > 0 ? (entry.split_details as string[]) : allIds
      const share = entry.amount / participants.length
      for (const pid of participants) {
        owed.set(pid, (owed.get(pid) ?? 0) + share)
      }
    } else {
      for (const detail of entry.split_details as ExactShare[]) {
        owed.set(detail.member_id, (owed.get(detail.member_id) ?? 0) + detail.share)
      }
    }
  }

  return members.map((member) => {
    const mPaid = paid.get(member.id) ?? 0
    const mOwed = owed.get(member.id) ?? 0
    const target = member.fixed_contribution ?? mOwed
    const balance = mPaid - target
    return { member, target, paid: mPaid, balance }
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

export function entryParticipantLabels(
  entry: LedgerEntry,
  members: Member[],
): { count: number; everyone: boolean } {
  if (entry.split_type === 'even') {
    if (entry.split_details.length === 0) return { count: members.length, everyone: true }
    return { count: entry.split_details.length, everyone: false }
  }
  return { count: (entry.split_details as ExactShare[]).length, everyone: false }
}