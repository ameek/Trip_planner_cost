import { useSyncExternalStore } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './api'
import type { LedgerEntry, Member, PlanDay, PlanStop, Tag, TripPublic } from './types'

export function useTripQuery(shortId: string) {
  return useQuery<TripPublic | null>({
    queryKey: ['trip', shortId],
    queryFn: () => api.fetchTrip(shortId),
    staleTime: 5 * 60 * 1000,
  })
}

export const membersKey = (tripId: string) => ['members', tripId] as const
export const daysKey = (tripId: string) => ['days', tripId] as const
export const stopsKey = (tripId: string) => ['stops', tripId] as const
export const tagsKey = (tripId: string) => ['tags', tripId] as const
export const entriesKey = (tripId: string) => ['entries', tripId] as const
export const revisionsKey = (entryId: string) => ['revisions', entryId] as const

export function useMembers(tripId: string) {
  return useQuery<Member[]>({ queryKey: membersKey(tripId), queryFn: () => api.fetchMembers(tripId) })
}

export function useDays(tripId: string) {
  return useQuery<PlanDay[]>({ queryKey: daysKey(tripId), queryFn: () => api.fetchDays(tripId) })
}

export function useStops(tripId: string) {
  return useQuery<PlanStop[]>({
    queryKey: stopsKey(tripId),
    queryFn: async () => {
      const days = await api.fetchDays(tripId)
      return api.fetchStops(days.map((d) => d.id))
    },
  })
}

export function useTags(tripId: string) {
  return useQuery<Tag[]>({ queryKey: tagsKey(tripId), queryFn: () => api.fetchTags(tripId) })
}

export function useEntries(tripId: string) {
  return useQuery<LedgerEntry[]>({
    queryKey: entriesKey(tripId),
    queryFn: () => api.fetchEntries(tripId),
  })
}

export function useRevisions(entryId: string, enabled: boolean) {
  return useQuery({
    queryKey: revisionsKey(entryId),
    queryFn: () => api.fetchRevisions(entryId),
    enabled,
    staleTime: 60_000,
  })
}

export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb)
      window.addEventListener('offline', cb)
      return () => {
        window.removeEventListener('online', cb)
        window.removeEventListener('offline', cb)
      }
    },
    () => navigator.onLine,
    () => true,
  )
}

function listMutation<TItem, TVars>(
  _tripId: string,
  key: readonly string[],
  fn: (vars: TVars) => Promise<void>,
  apply: (prev: TItem[] | undefined, vars: TVars) => TItem[],
  extraInvalidate: readonly (readonly string[])[] = [],
) {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: key,
    mutationFn: fn,
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<TItem[]>(key)
      qc.setQueryData<TItem[]>(key, (old) => apply(old, vars))
      return { prev }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
      for (const k of extraInvalidate) qc.invalidateQueries({ queryKey: k })
    },
  })
}

export function useAddMember(tripId: string) {
  return listMutation<Member, string>(tripId, membersKey(tripId), (name) => api.addMember(tripId, name), (old, name) => [
    ...(old ?? []),
    {
      id: `tmp-${crypto.randomUUID()}`,
      trip_id: tripId,
      name: name.trim(),
      fixed_contribution: null,
      sort_order: (old?.length ?? 0) + 1,
      created_at: new Date().toISOString(),
    },
  ])
}

export function useDeleteMember(tripId: string) {
  return listMutation<Member, string>(
    tripId,
    membersKey(tripId),
    (memberId) => api.deleteMember(tripId, memberId),
    (old, memberId) => (old ?? []).filter((m) => m.id !== memberId),
    [entriesKey(tripId)],
  )
}

export function useSetContribution(tripId: string) {
  return listMutation<Member, { memberId: string; contribution: number | null }>(
    tripId,
    membersKey(tripId),
    (v) => api.updateMemberContribution(v.memberId, v.contribution),
    (old, v) => (old ?? []).map((m) => (m.id === v.memberId ? { ...m, fixed_contribution: v.contribution } : m)),
  )
}

export function useAddTag(tripId: string) {
  return listMutation<Tag, string>(tripId, tagsKey(tripId), (label) => api.addTag(tripId, label), (old, label) => [
    ...(old ?? []),
    { id: `tmp-${crypto.randomUUID()}`, trip_id: tripId, label: label.trim(), sort_order: (old?.length ?? 0) + 1 },
  ])
}

export function useDeleteTag(tripId: string) {
  return listMutation<Tag, string>(
    tripId,
    tagsKey(tripId),
    (tagId) => api.deleteTag(tagId),
    (old, tagId) => (old ?? []).filter((t) => t.id !== tagId),
  )
}

export function useAddDay(tripId: string) {
  return listMutation<PlanDay, api.NewDayInput>(
    tripId,
    daysKey(tripId),
    (data) => api.addDay(tripId, data),
    (old, data) => [
      ...(old ?? []),
      {
        id: `tmp-${crypto.randomUUID()}`,
        trip_id: tripId,
        date_label: data.date_label,
        title: data.title,
        is_overnight: data.is_overnight,
        sort_order: (old?.length ?? 0) + 1,
      },
    ],
    [stopsKey(tripId)],
  )
}

export function useAddDaysBatch(tripId: string) {
  return listMutation<PlanDay, api.NewDayInput[]>(
    tripId,
    daysKey(tripId),
    (inputs) => api.addDaysBatch(tripId, inputs),
    (old, inputs) => [
      ...(old ?? []),
      ...inputs.map((data, idx) => ({
        id: `tmp-${crypto.randomUUID()}-${idx}`,
        trip_id: tripId,
        date_label: data.date_label,
        title: data.title,
        is_overnight: data.is_overnight,
        sort_order: (old?.length ?? 0) + 1 + idx,
      })),
    ],
    [stopsKey(tripId)],
  )
}

export function useUpdateDay(tripId: string) {
  return listMutation<PlanDay, { dayId: string; patch: Partial<api.NewDayInput> }>(
    tripId,
    daysKey(tripId),
    (v) => api.updateDay(v.dayId, v.patch),
    (old, v) => (old ?? []).map((d) => (d.id === v.dayId ? { ...d, ...v.patch } : d)),
  )
}

export function useDeleteDay(tripId: string) {
  return listMutation<PlanDay, string>(
    tripId,
    daysKey(tripId),
    (dayId) => api.deleteDay(dayId),
    (old, dayId) => (old ?? []).filter((d) => d.id !== dayId),
    [stopsKey(tripId)],
  )
}

export function useMoveDay(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: daysKey(tripId),
    mutationFn: (vars: { dayId: string; direction: -1 | 1 }) =>
      api.moveDay(vars.dayId, vars.direction, (qc.getQueryData<PlanDay[]>(daysKey(tripId)) ?? []).sort((a, b) => a.sort_order - b.sort_order)),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: daysKey(tripId) })
      const prev = qc.getQueryData<PlanDay[]>(daysKey(tripId))
      const ordered = [...(prev ?? [])].sort((a, b) => a.sort_order - b.sort_order)
      const idx = ordered.findIndex((d) => d.id === vars.dayId)
      const other = ordered[idx + vars.direction]
      if (other) {
        const a = ordered[idx]
        qc.setQueryData<PlanDay[]>(daysKey(tripId), (old) =>
          (old ?? []).map((d) =>
            d.id === a.id ? { ...d, sort_order: other.sort_order } : d.id === other.id ? { ...d, sort_order: a.sort_order } : d,
          ),
        )
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(daysKey(tripId), ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: daysKey(tripId) }),
  })
}

export function useAddStop(tripId: string) {
  return listMutation<PlanStop, { dayId: string; label: string; isStay: boolean }>(
    tripId,
    stopsKey(tripId),
    (v) => api.addStop(v.dayId, v.label, v.isStay),
    (old, v) => [
      ...(old ?? []),
      { id: `tmp-${crypto.randomUUID()}`, day_id: v.dayId, label: v.label.trim(), is_stay: v.isStay, sort_order: (old?.length ?? 0) + 1 },
    ],
  )
}

export function useDeleteStop(tripId: string) {
  return listMutation<PlanStop, string>(
    tripId,
    stopsKey(tripId),
    (stopId) => api.deleteStop(stopId),
    (old, stopId) => (old ?? []).filter((s) => s.id !== stopId),
  )
}

export function useMoveStop(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: stopsKey(tripId),
    mutationFn: (vars: { stopId: string; dayId: string; direction: -1 | 1 }) =>
      api.moveStop(vars.stopId, vars.direction, (qc.getQueryData<PlanStop[]>(stopsKey(tripId)) ?? []).sort((a, b) => a.sort_order - b.sort_order)),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: stopsKey(tripId) })
      const prev = qc.getQueryData<PlanStop[]>(stopsKey(tripId))
      const ordered = [...(prev ?? [])].sort((a, b) => a.sort_order - b.sort_order)
      const idx = ordered.findIndex((s) => s.id === vars.stopId)
      const other = ordered[idx + vars.direction]
      if (other) {
        const a = ordered[idx]
        qc.setQueryData<PlanStop[]>(stopsKey(tripId), (old) =>
          (old ?? []).map((s) =>
            s.id === a.id ? { ...s, sort_order: other.sort_order } : s.id === other.id ? { ...s, sort_order: a.sort_order } : s,
          ),
        )
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(stopsKey(tripId), ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: stopsKey(tripId) }),
  })
}