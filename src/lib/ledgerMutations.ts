import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query'
import { queryClient } from './queryClient'
import * as api from './api'
import { entriesKey } from './queries'
import type { LedgerEntry } from './types'

const ledgerKey = (tripId: string) => ['ledgerEntry', tripId] as const

export interface EntryCreateVars {
  clientId: string
  data: api.NewEntryInput
}

export interface EntryUpdateVars {
  id: string
  data: api.NewEntryInput
}

export function useCreateEntry(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ledgerKey(tripId),
    mutationFn: (vars: EntryCreateVars) => api.addEntry(tripId, vars.data),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: entriesKey(tripId) })
      const prev = qc.getQueryData<LedgerEntry[]>(entriesKey(tripId))
      const temp: LedgerEntry = {
        id: vars.clientId,
        trip_id: tripId,
        description: vars.data.description,
        amount: vars.data.amount,
        paid_by: vars.data.paid_by,
        category: vars.data.category,
        tag_id: vars.data.tag_id,
        split_type: vars.data.split_type,
        split_details: vars.data.split_details,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      qc.setQueryData<LedgerEntry[]>(entriesKey(tripId), (old) => [...(old ?? []), temp])
      return { prev }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(entriesKey(tripId), ctx?.prev),
    onSuccess: () => qc.invalidateQueries({ queryKey: entriesKey(tripId) }),
  })
}

export function useUpdateEntry(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ledgerKey(tripId),
    mutationFn: (vars: EntryUpdateVars) => api.updateEntry(vars.id, vars.data),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: entriesKey(tripId) })
      const prev = qc.getQueryData<LedgerEntry[]>(entriesKey(tripId))
      qc.setQueryData<LedgerEntry[]>(entriesKey(tripId), (old) =>
        (old ?? []).map((e) =>
          e.id === vars.id
            ? { ...e, ...vars.data, updated_at: new Date().toISOString() }
            : e,
        ),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(entriesKey(tripId), ctx?.prev),
    onSuccess: () => qc.invalidateQueries({ queryKey: entriesKey(tripId) }),
  })
}

export function useDeleteEntry(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ledgerKey(tripId),
    mutationFn: (vars: { id: string }) => api.deleteEntry(vars.id),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: entriesKey(tripId) })
      const prev = qc.getQueryData<LedgerEntry[]>(entriesKey(tripId))
      qc.setQueryData<LedgerEntry[]>(entriesKey(tripId), (old) =>
        (old ?? []).filter((e) => e.id !== vars.id),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(entriesKey(tripId), ctx?.prev),
    onSuccess: () => qc.invalidateQueries({ queryKey: entriesKey(tripId) }),
  })
}

export type RowSyncState = 'ok' | 'syncing' | 'queued' | 'failed'

export function useLedgerRowStatus(tripId: string, entryId: string): RowSyncState {
  const states = useMutationState({
    filters: { mutationKey: ledgerKey(tripId) },
  })
  const m = states
    .filter((s) => {
      const v = s.variables as { clientId?: string; id?: string } | undefined
      return v?.clientId === entryId || v?.id === entryId
    })
    .find((s) => s.status !== 'success')
  if (!m) return 'ok'
  if (m.status === 'error') return 'failed'
  if (m.isPaused) return 'queued'
  return 'syncing'
}

export function useSyncCounts() {
  const states = useMutationState({})
  return {
    paused: states.filter((s) => s.isPaused).length,
    syncing: states.filter((s) => s.status === 'pending' && !s.isPaused).length,
  }
}

export function retryEntryMutation(tripId: string, entryId: string) {
  const mutation = queryClient
    .getMutationCache()
    .getAll()
    .find((m) => {
      const key = m.options.mutationKey
      const v = m.state.variables as { clientId?: string; id?: string } | undefined
      return (
        Array.isArray(key) &&
        key[0] === 'ledgerEntry' &&
        key[1] === tripId &&
        (v?.clientId === entryId || v?.id === entryId)
      )
    })
  if (mutation) {
    const exec = (mutation as unknown as { execute?: () => Promise<unknown> }).execute
    if (exec) void exec.call(mutation)
  }
}