import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import * as api from './api'
import { formatMoney as formatCurrency } from './format'
import type { LedgerEntry, Member, PlanDay, PlanStop, TripPublic } from './types'

export interface TripContextValue {
  trip: TripPublic
  members: Member[]
  days: PlanDay[]
  stops: PlanStop[]
  entries: LedgerEntry[]
  editable: boolean
  error: string | null
  clearError: () => void
  mutate: (fn: () => Promise<unknown>) => Promise<boolean>
  refresh: () => Promise<void>
  unlockInput: string
  setUnlockInput: (v: string) => void
  codeError: string | null
  verifying: boolean
  unlock: () => Promise<void>
  lock: () => void
  formatMoney: (amount: number) => string
}

const TripContext = createContext<TripContextValue | null>(null)

export function useTrip(): TripContextValue {
  const ctx = useContext(TripContext)
  if (!ctx) throw new Error('useTrip must be used inside TripProvider')
  return ctx
}

function loadData(tripId: string) {
  return Promise.all([api.fetchMembers(tripId), api.fetchDays(tripId), api.fetchEntries(tripId)]).then(
    ([members, days, entries]) =>
      api.fetchStops(days.map((d) => d.id)).then((stops) => ({ members, days, entries, stops })),
  )
}

export function TripProvider({ shortId, children }: { shortId: string; children: ReactNode }) {
  const [trip, setTrip] = useState<TripPublic | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [days, setDays] = useState<PlanDay[]>([])
  const [stops, setStops] = useState<PlanStop[]>([])
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [editable, setEditable] = useState(() => sessionStorage.getItem(api.lockKey(shortId)) === '1')
  const [error, setError] = useState<string | null>(null)
  const [unlockInput, setUnlockInput] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const t = await api.fetchTrip(shortId)
        if (cancelled) return
        if (!t) {
          setTrip(null)
          setLoading(false)
          return
        }
        setTrip(t)
        const data = await loadData(t.id)
        if (cancelled) return
        setMembers(data.members)
        setDays(data.days)
        setStops(data.stops)
        setEntries(data.entries)
        setLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load the trip.')
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [shortId])

  const refresh = useCallback(async () => {
    if (!trip) return
    try {
      const data = await loadData(trip.id)
      setMembers(data.members)
      setDays(data.days)
      setStops(data.stops)
      setEntries(data.entries)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh the trip.')
    }
  }, [trip])

  const mutate = useCallback(async (fn: () => Promise<unknown>) => {
    try {
      await fn()
      setError(null)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      return false
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const unlock = useCallback(async () => {
    if (unlockInput.length !== 4) {
      setCodeError('Enter the 4-digit code.')
      return
    }
    setVerifying(true)
    setCodeError(null)
    try {
      const ok = await api.verifyCode(shortId, unlockInput)
      if (ok) {
        sessionStorage.setItem(api.lockKey(shortId), '1')
        setEditable(true)
        setUnlockInput('')
      } else {
        setCodeError("That code didn't match. Try again.")
      }
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : 'Could not verify the code.')
    } finally {
      setVerifying(false)
    }
  }, [shortId, unlockInput])

  const lock = useCallback(() => {
    sessionStorage.removeItem(api.lockKey(shortId))
    setEditable(false)
    setUnlockInput('')
    setCodeError(null)
  }, [shortId])

  const formatMoney = useCallback(
    (amount: number) => formatCurrency(amount, trip?.currency ?? 'BDT'),
    [trip],
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-sand">
        <div className="mx-auto max-w-3xl px-4 pt-20 text-center">
          <p className="font-mono text-sm text-moss">Loading the trip…</p>
        </div>
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-sand">
        <div className="mx-auto max-w-3xl px-4 pt-20">
          <div className="card p-6 text-center">
            <div className="eyebrow">Trailmark</div>
            <h1 className="mt-2 font-display text-2xl font-bold text-pine">
              {error ? 'Could not load the trip' : 'Trip not found'}
            </h1>
            <p className="mt-2 text-sm text-moss">
              {error ??
                'Check that the link is correct, or ask whoever shared it for a fresh one.'}
            </p>
            <Link to="/" className="btn btn-primary mt-5 inline-flex">
              Back to start
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const value: TripContextValue = {
    trip,
    members,
    days,
    stops,
    entries,
    editable,
    error,
    clearError,
    mutate,
    refresh,
    unlockInput,
    setUnlockInput,
    codeError,
    verifying,
    unlock,
    lock,
    formatMoney,
  }

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>
}