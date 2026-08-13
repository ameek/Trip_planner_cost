import { QueryClient } from '@tanstack/react-query'
import { del, get, set } from 'idb-keyval'
import type { PersistedClient, Persister } from '@tanstack/query-persist-client-core'

export const PERSIST_KEY = 'trailmark:query'
export const PERSIST_BUSTER = 'trailmark-v3'

export function createIdbPersister(key = PERSIST_KEY): Persister {
  return {
    persistClient: (client: PersistedClient) => set(key, client),
    restoreClient: () => get<PersistedClient>(key),
    removeClient: () => del(key),
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 1000 * 60 * 60 * 24 * 30,
      refetchOnWindowFocus: true,
      retry: 2,
      networkMode: 'online',
    },
    mutations: {
      retry: 2,
      networkMode: 'offlineFirst',
    },
  },
})