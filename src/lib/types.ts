export type Category = 'accommodation' | 'food' | 'transport' | 'other'

export const CATEGORIES: Category[] = ['accommodation', 'food', 'transport', 'other']

export const CATEGORY_LABELS: Record<Category, string> = {
  accommodation: 'Accommodation',
  food: 'Food',
  transport: 'Transport',
  other: 'Other',
}

export type SplitType = 'even' | 'exact'

export type TabKey = 'plan' | 'ledger' | 'members' | 'settle'

export interface TripPublic {
  id: string
  short_id: string
  name: string
  currency: string
  created_at: string
}

export interface Member {
  id: string
  trip_id: string
  name: string
  fixed_contribution: number | null
  sort_order: number
  created_at: string
}

export interface Tag {
  id: string
  trip_id: string
  label: string
  sort_order: number
}

export interface PlanDay {
  id: string
  trip_id: string
  date_label: string
  title: string
  is_overnight: boolean
  sort_order: number
}

export interface PlanStop {
  id: string
  day_id: string
  label: string
  is_stay: boolean
  sort_order: number
}

export interface EntryPayer {
  member_id: string
  amount: number
}

export interface ExactShare {
  member_id: string
  share: number
}

export interface LedgerEntry {
  id: string
  trip_id: string
  description: string
  amount: number
  paid_by: EntryPayer[]
  category: Category | null
  tag_id: string | null
  split_type: SplitType
  split_details: string[] | ExactShare[]
  created_at: string
  updated_at: string
}

export interface ExpenseRevision {
  id: string
  entry_id: string
  snapshot: LedgerEntry
  edited_at: string
}

export function isEvenSplit(entry: Pick<LedgerEntry, 'split_type'>): boolean {
  return entry.split_type === 'even'
}