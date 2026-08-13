export type SplitMode = 'even' | 'fixed'

export type Category = 'accommodation' | 'food' | 'transport' | 'other'

export const CATEGORIES: Category[] = ['accommodation', 'food', 'transport', 'other']

export const CATEGORY_LABELS: Record<Category, string> = {
  accommodation: 'Accommodation',
  food: 'Food',
  transport: 'Transport',
  other: 'Other',
}

export type TabKey = 'plan' | 'ledger' | 'members' | 'settle'

export interface TripPublic {
  id: string
  short_id: string
  name: string
  split_mode: SplitMode
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

export interface LedgerEntry {
  id: string
  trip_id: string
  description: string
  amount: number
  paid_by: string | null
  category: Category | null
  split_between: string[]
  created_at: string
}