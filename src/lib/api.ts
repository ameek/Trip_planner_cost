import { supabase } from './supabase'
import type {
  Category,
  EntryPayer,
  ExactShare,
  ExpenseRevision,
  LedgerEntry,
  Member,
  PlanDay,
  PlanStop,
  SplitType,
  Tag,
  TripPublic,
} from './types'

export const lockKey = (shortId: string) => `trailmark:unlocked:${shortId}`

const SHORT_ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

function genShortId(length = 6): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < length; i++) out += SHORT_ID_CHARS[bytes[i] % SHORT_ID_CHARS.length]
  return out
}

export async function createTrip(name: string, editCode: string): Promise<{ shortId: string }> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const shortId = genShortId()
    const { data, error } = await supabase
      .from('trips')
      .insert({ short_id: shortId, name: name.trim(), edit_code: editCode })
      .select('short_id')
      .single()
    if (!error && data) return { shortId: data.short_id }
    if (error && error.code !== '23505') throw new Error(error.message)
  }
  throw new Error('Could not create the trip. Please try again.')
}

export async function fetchTrip(shortId: string): Promise<TripPublic | null> {
  const { data, error } = await supabase.rpc('get_trip_public', { p_short_id: shortId })
  if (error) throw new Error(error.message)
  const rows = Array.isArray(data) ? data : data == null ? [] : [data]
  return (rows[0] as TripPublic | undefined) ?? null
}

export async function verifyCode(shortId: string, code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('verify_trip_code', { p_short_id: shortId, p_code: code })
  if (error) throw new Error(error.message)
  return data === true
}

export async function fetchMembers(tripId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('trip_id', tripId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((m: any) => ({
    ...m,
    fixed_contribution: m.fixed_contribution == null ? null : Number(m.fixed_contribution),
  }))
}

export async function addMember(tripId: string, name: string): Promise<void> {
  const { data } = await supabase
    .from('members')
    .select('sort_order')
    .eq('trip_id', tripId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const sortOrder = data && data[0] ? Number(data[0].sort_order) + 1 : 1
  const { error } = await supabase
    .from('members')
    .insert({ trip_id: tripId, name: name.trim(), sort_order: sortOrder })
  if (error) throw new Error(error.message)
}

export async function updateMemberContribution(memberId: string, contribution: number | null): Promise<void> {
  const { error } = await supabase
    .from('members')
    .update({ fixed_contribution: contribution })
    .eq('id', memberId)
  if (error) throw new Error(error.message)
}

async function scrubEntriesOfMember(tripId: string, memberId: string): Promise<void> {
  const { data } = await supabase
    .from('ledger_entries')
    .select('*')
    .eq('trip_id', tripId)
  if (!data) return
  for (const row of data) {
    const patch: Record<string, unknown> = {}
    const payers = (row.paid_by ?? []) as EntryPayer[]
    if (payers.some((p) => p.member_id === memberId)) {
      patch.paid_by = payers.filter((p) => p.member_id !== memberId)
    }
    if (row.split_type === 'even') {
      const evenIds = row.split_details as string[]
      if (evenIds.includes(memberId)) {
        patch.split_details = evenIds.filter((id) => id !== memberId)
      }
    } else {
      const shares = row.split_details as ExactShare[]
      if (shares.some((s) => s.member_id === memberId)) {
        const remaining = shares.filter((s) => s.member_id !== memberId)
        if (remaining.length === 0) {
          patch.split_type = 'even'
          patch.split_details = []
        } else {
          patch.split_details = remaining
        }
      }
    }
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from('ledger_entries').update(patch).eq('id', row.id)
      if (error) throw new Error(error.message)
    }
  }
}

export async function deleteMember(tripId: string, memberId: string): Promise<void> {
  await scrubEntriesOfMember(tripId, memberId)
  const { error } = await supabase.from('members').delete().eq('id', memberId)
  if (error) throw new Error(error.message)
}

export async function fetchTags(tripId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('trip_id', tripId)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function addTag(tripId: string, label: string): Promise<void> {
  const { data } = await supabase
    .from('tags')
    .select('sort_order')
    .eq('trip_id', tripId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const sortOrder = data && data[0] ? Number(data[0].sort_order) + 1 : 1
  const { error } = await supabase
    .from('tags')
    .insert({ trip_id: tripId, label: label.trim(), sort_order: sortOrder })
  if (error) throw new Error(error.message)
}

export async function deleteTag(tagId: string): Promise<void> {
  const { error } = await supabase.from('tags').delete().eq('id', tagId)
  if (error) throw new Error(error.message)
}

export async function fetchDays(tripId: string): Promise<PlanDay[]> {
  const { data, error } = await supabase
    .from('plan_days')
    .select('*')
    .eq('trip_id', tripId)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export interface NewDayInput {
  date_label: string
  title: string
  is_overnight: boolean
}

export async function addDay(tripId: string, input: NewDayInput): Promise<void> {
  const { data } = await supabase
    .from('plan_days')
    .select('sort_order')
    .eq('trip_id', tripId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const sortOrder = data && data[0] ? Number(data[0].sort_order) + 1 : 1
  const { error } = await supabase
    .from('plan_days')
    .insert({ trip_id: tripId, ...input, sort_order: sortOrder })
  if (error) throw new Error(error.message)
}

export async function addDaysBatch(tripId: string, inputs: NewDayInput[]): Promise<void> {
  if (inputs.length === 0) return
  const { data } = await supabase
    .from('plan_days')
    .select('sort_order')
    .eq('trip_id', tripId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const baseSortOrder = data && data[0] ? Number(data[0].sort_order) + 1 : 1
  const rows = inputs.map((input, idx) => ({
    trip_id: tripId,
    ...input,
    sort_order: baseSortOrder + idx,
  }))
  const { error } = await supabase.from('plan_days').insert(rows)
  if (error) throw new Error(error.message)
}

export async function updateDay(dayId: string, patch: Partial<NewDayInput>): Promise<void> {
  const { error } = await supabase.from('plan_days').update(patch).eq('id', dayId)
  if (error) throw new Error(error.message)
}

export async function deleteDay(dayId: string): Promise<void> {
  const { error } = await supabase.from('plan_days').delete().eq('id', dayId)
  if (error) throw new Error(error.message)
}

export async function moveDay(dayId: string, direction: -1 | 1, ordered: PlanDay[]): Promise<void> {
  const index = ordered.findIndex((d) => d.id === dayId)
  const other = ordered[index + direction]
  if (index < 0 || !other) return
  const a = ordered[index]
  await Promise.all([
    supabase.from('plan_days').update({ sort_order: other.sort_order }).eq('id', a.id),
    supabase.from('plan_days').update({ sort_order: a.sort_order }).eq('id', other.id),
  ])
}

export async function fetchStops(dayIds: string[]): Promise<PlanStop[]> {
  if (dayIds.length === 0) return []
  const { data, error } = await supabase
    .from('plan_stops')
    .select('*')
    .in('day_id', dayIds)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function addStop(dayId: string, label: string, isStay: boolean): Promise<void> {
  const { data } = await supabase
    .from('plan_stops')
    .select('sort_order')
    .eq('day_id', dayId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const sortOrder = data && data[0] ? Number(data[0].sort_order) + 1 : 1
  const { error } = await supabase
    .from('plan_stops')
    .insert({ day_id: dayId, label: label.trim(), is_stay: isStay, sort_order: sortOrder })
  if (error) throw new Error(error.message)
}

export async function deleteStop(stopId: string): Promise<void> {
  const { error } = await supabase.from('plan_stops').delete().eq('id', stopId)
  if (error) throw new Error(error.message)
}

export async function moveStop(
  stopId: string,
  direction: -1 | 1,
  ordered: PlanStop[],
): Promise<void> {
  const index = ordered.findIndex((s) => s.id === stopId)
  const other = ordered[index + direction]
  if (index < 0 || !other) return
  const a = ordered[index]
  await Promise.all([
    supabase.from('plan_stops').update({ sort_order: other.sort_order }).eq('id', a.id),
    supabase.from('plan_stops').update({ sort_order: a.sort_order }).eq('id', other.id),
  ])
}

export async function fetchEntries(tripId: string): Promise<LedgerEntry[]> {
  const { data, error } = await supabase
    .from('ledger_entries')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(toEntry)
}

function toEntry(row: any): LedgerEntry {
  return {
    id: row.id,
    trip_id: row.trip_id,
    description: row.description,
    amount: Number(row.amount),
    paid_by: (row.paid_by ?? []).map((p: any) => ({
      member_id: p.member_id,
      amount: Number(p.amount),
    })),
    category: row.category as Category | null,
    tag_id: row.tag_id ?? null,
    split_type: row.split_type as SplitType,
    split_details:
      row.split_type === 'exact'
        ? (row.split_details ?? []).map((s: any) => ({ member_id: s.member_id, share: Number(s.share) }))
        : (row.split_details ?? []) as string[],
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export interface NewEntryInput {
  description: string
  amount: number
  paid_by: EntryPayer[]
  category: Category | null
  tag_id: string | null
  split_type: SplitType
  split_details: string[] | ExactShare[]
}

export async function addEntry(tripId: string, input: NewEntryInput): Promise<void> {
  const { error } = await supabase.from('ledger_entries').insert({ trip_id: tripId, ...input })
  if (error) throw new Error(error.message)
}

export async function updateEntry(entryId: string, input: NewEntryInput): Promise<void> {
  const { error } = await supabase
    .from('ledger_entries')
    .update(input)
    .eq('id', entryId)
  if (error) throw new Error(error.message)
}

export async function deleteEntry(entryId: string): Promise<void> {
  const { error } = await supabase.from('ledger_entries').delete().eq('id', entryId)
  if (error) throw new Error(error.message)
}

export async function fetchRevisions(entryId: string): Promise<ExpenseRevision[]> {
  const { data, error } = await supabase
    .from('expense_revisions')
    .select('*')
    .eq('entry_id', entryId)
    .order('edited_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: any) => ({
    id: r.id,
    entry_id: r.entry_id,
    snapshot: toEntry(r.snapshot),
    edited_at: r.edited_at,
  }))
}